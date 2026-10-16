using System;
using System.IO;
using System.Reflection;
using System.Text;
using System.Linq;
using AutoMapper;
using Aquri.API.Common;
using Aquri.Application.Common.Behaviors;
using Aquri.Application.Common.Interfaces;
using Aquri.Application.DTOs;
using Aquri.Application.MappingProfiles;
using Aquri.Application.Properties.Commands;
using Aquri.Application.Rooms.Commands;
using Aquri.Infrastructure.Persistence;
using Aquri.Infrastructure.Security;
using MediatR;
using Microsoft.AspNetCore.Authentication.JwtBearer;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Options;
using Microsoft.IdentityModel.Tokens;
using Microsoft.OpenApi.Models;
using Microsoft.AspNetCore.Mvc.Versioning;
using Microsoft.AspNetCore.RateLimiting;
using System.Threading.RateLimiting;
using Serilog;

var builder = WebApplication.CreateBuilder(args);

// Serilog: structured logging to console + rolling file
Log.Logger = new LoggerConfiguration()
    .ReadFrom.Configuration(builder.Configuration)
    .Enrich.FromLogContext()
    .Enrich.WithProperty("Application", "Aquri.API")
    .WriteTo.Console(outputTemplate: "[{Timestamp:HH:mm:ss} {Level:u3}] {Message:lj} {Properties:j}{NewLine}{Exception}")
    .WriteTo.File("logs/aquri-.log", rollingInterval: RollingInterval.Day, retainedFileCountLimit: 7)
    .CreateLogger();

builder.Host.UseSerilog();

// Connection string (declared early — used by health checks + DbContext).
// No fallback: a missing value must fail fast, not silently connect somewhere unexpected.
var connectionString = builder.Configuration.GetConnectionString("DefaultConnection");
if (string.IsNullOrWhiteSpace(connectionString))
    throw new InvalidOperationException(
        "Missing configuration: ConnectionStrings:DefaultConnection. Set it in appsettings.Development.json, the environment variable ConnectionStrings__DefaultConnection, or the compose .env file.");

// Controllers. Default web JSON options (camelCase) — DTOs are flat, so no
// ReferenceHandler.Preserve and no indentation (compact payloads, clean
// frontend parsing; the ApiResponse envelope is applied by middleware).
builder.Services.AddControllers();

// TimeProvider for middleware/services that need a fakeable clock in tests
builder.Services.AddSingleton(TimeProvider.System);

// CORS: allow the frontend dev servers
var corsOrigins = builder.Configuration.GetSection("Cors:AllowedOrigins").Get<string[]>()
    ?? new[] { "http://localhost:4200", "http://localhost:5173", "http://localhost:3000" };
builder.Services.AddCors(options =>
{
    options.AddPolicy("FrontendPolicy", policy =>
    {
        policy.WithOrigins(corsOrigins)
              .AllowAnyHeader()
              .AllowAnyMethod()
              .AllowCredentials();
    });
});

// JWT Authentication — signing key must be present and long enough (HMAC-SHA256 needs >= 32 bytes)
var jwtSection = builder.Configuration.GetSection("Jwt");
var jwtKey = jwtSection["Key"];
if (string.IsNullOrWhiteSpace(jwtKey) || jwtKey.Length < 32)
    throw new InvalidOperationException(
        "Missing configuration: Jwt:Key (minimum 32 characters). Set it in appsettings.Development.json, the environment variable Jwt__Key, or the compose .env file.");
var jwtIssuer = jwtSection["Issuer"] ?? "Aquri.API";
var jwtAudience = jwtSection["Audience"] ?? "Aquri.Client";

builder.Services.AddAuthentication(JwtBearerDefaults.AuthenticationScheme)
    .AddJwtBearer(options =>
    {
        options.TokenValidationParameters = new TokenValidationParameters
        {
            ValidateIssuer = true,
            ValidateAudience = true,
            ValidateLifetime = true,
            ValidateIssuerSigningKey = true,
            ValidIssuer = jwtIssuer,
            ValidAudience = jwtAudience,
            IssuerSigningKey = new SymmetricSecurityKey(Encoding.UTF8.GetBytes(jwtKey))
        };
    });

builder.Services.AddAuthorization();

// Rate limiting: brute-force protection on login (policy "auth", applied via
// [EnableRateLimiting] on the Login action only). Partitioned per client IP.
// Tests switch it off through RateLimiting:AuthEnabled — TestServer requests
// share a null remote IP, so a shared partition would throttle parallel logins.
var authRateLimitEnabled = builder.Configuration.GetValue("RateLimiting:AuthEnabled", true);
builder.Services.AddRateLimiter(options =>
{
    options.RejectionStatusCode = StatusCodes.Status429TooManyRequests;
    options.AddPolicy("auth", httpContext =>
    {
        var partitionKey = httpContext.Connection.RemoteIpAddress?.ToString() ?? "unknown";
        if (!authRateLimitEnabled)
            return RateLimitPartition.GetNoLimiter(partitionKey);

        return RateLimitPartition.GetFixedWindowLimiter(partitionKey, _ => new FixedWindowRateLimiterOptions
        {
            PermitLimit = 10,
            Window = TimeSpan.FromMinutes(1),
            QueueLimit = 0,
            AutoReplenishment = true
        });
    });
});

// Health checks: database + self
builder.Services.AddHealthChecks()
    .AddNpgSql(connectionString, name: "postgresql")
    .AddCheck("self", () => Microsoft.Extensions.Diagnostics.HealthChecks.HealthCheckResult.Healthy("API is running"));

// EF Core + PostgreSQL (scoped DbContext IS the unit of work — shared by all handlers)
builder.Services.AddDbContext<AquriDbContext>(options => options.UseNpgsql(connectionString));

// Application layer abstraction over the DbContext (used by MediatR handlers)
builder.Services.AddScoped<IApplicationDbContext>(provider => provider.GetRequiredService<AquriDbContext>());

// Auth: password hashing (PBKDF2) + JWT issuance
builder.Services.AddScoped<IPasswordHasher, Pbkdf2PasswordHasher>();
builder.Services.AddScoped<ITokenService, JwtTokenService>();

// Current caller from the JWT principal — drives the property-scope behavior
// below (null scope = unrestricted, the security default)
builder.Services.AddHttpContextAccessor();
builder.Services.AddScoped<ICurrentUser, HttpCurrentUser>();

// Unique business numbers (TKT-/INV-/PAY-) allocated from NumberSequence rows
builder.Services.AddScoped<INumberGenerator, NumberGenerator>();

// AI chat: deterministic replies from live stats; swap HybridChatClient in once a key is provided
builder.Services.Configure<Aquri.Application.AiChat.AiChatOptions>(builder.Configuration.GetSection(Aquri.Application.AiChat.AiChatOptions.SectionName));
builder.Services.AddScoped<Aquri.Application.AiChat.ChatStatsProvider>();
builder.Services.AddScoped<Aquri.Application.AiChat.OpenAiCompatibleClient>();
builder.Services.AddScoped<Aquri.Application.AiChat.DeterministicChatClient>();
builder.Services.AddScoped<Aquri.Application.AiChat.IAiChatClient, Aquri.Application.AiChat.HybridChatClient>();
builder.Services.AddHttpClient(Aquri.Application.AiChat.OpenAiCompatibleClient.HttpClientName, (services, client) =>
{
    var options = services.GetRequiredService<IOptions<Aquri.Application.AiChat.AiChatOptions>>().Value;
    client.Timeout = TimeSpan.FromSeconds(options.TimeoutSeconds);
});

// Agent run generator: one deterministic recipe per agent key (spec §6)
builder.Services.AddScoped<Aquri.Application.AiAgents.AgentInsightGenerator>();

// MediatR application service layer (command/query handlers); the behavior
// confines property-assigned accounts to their own property (403 otherwise)
builder.Services.AddMediatR(cfg =>
{
    cfg.RegisterServicesFromAssembly(typeof(CreatePropertyCommand).Assembly);
    cfg.AddBehavior(typeof(IPipelineBehavior<,>), typeof(PropertyScopeBehavior<,>));
});

// AutoMapper configuration (manual — deterministic, no assembly scanning)
var mappingConfig = new MapperConfiguration(mc => mc.AddProfile<MappingProfile>());
IMapper mapper = mappingConfig.CreateMapper();
builder.Services.AddSingleton(mapper);

// API versioning (default API version = v1)
builder.Services.AddApiVersioning(options =>
{
    options.AssumeDefaultVersionWhenUnspecified = true;
    options.ReportApiVersions = true;
});

// Versioned API explorer for Swagger
builder.Services.AddVersionedApiExplorer(options =>
{
    options.GroupNameFormat = "vVVV";
    options.SubstituteApiVersionInUrl = true;
});

// Swagger
builder.Services.AddSwaggerGen(options =>
{
    options.SwaggerDoc("v1", new OpenApiInfo
    {
        Title = "Aquri API",
        Version = "v1",
        Description = "Aquri Property Management System API",
        Contact = new OpenApiContact
        {
            Name = "Aquri Support",
            Email = "support@aquri.com"
        }
    });

    var xmlFile = $"{Assembly.GetExecutingAssembly().GetName().Name}.xml";
    var xmlPath = Path.Combine(AppContext.BaseDirectory, xmlFile);
    if (File.Exists(xmlPath))
    {
        options.IncludeXmlComments(xmlPath);
    }

    options.AddSecurityDefinition("Bearer", new OpenApiSecurityScheme
    {
        Description = "JWT Authorization header using the Bearer scheme. Example: \"Authorization: Bearer {token}\"",
        Name = "Authorization",
        In = ParameterLocation.Header,
        Type = SecuritySchemeType.ApiKey
    });

    options.AddSecurityRequirement(new OpenApiSecurityRequirement
    {
        {
            new OpenApiSecurityScheme
            {
                Reference = new OpenApiReference
                {
                    Type = ReferenceType.SecurityScheme,
                    Id = "Bearer"
                }
            },
            new string[] { }
        }
    });
});

var app = builder.Build();

// Global exception handling backstop (exceptions below ApiResponseMiddleware are
// caught there; this covers failures above it). Emits the ApiResponse envelope
// so the client contract holds even for unexpected 500s.
app.UseExceptionHandler(errorApp =>
{
    errorApp.Run(async context =>
    {
        var error = context.Features.Get<Microsoft.AspNetCore.Diagnostics.IExceptionHandlerFeature>();
        context.Response.StatusCode = StatusCodes.Status500InternalServerError;
        context.Response.ContentType = "application/json; charset=utf-8";

        var requestId = context.Items.TryGetValue(Aquri.API.Middleware.ApiResponseMiddleware.RequestIdItemKey, out var requestIdValue) && requestIdValue is string rid
            ? rid
            : context.Request.Headers[Aquri.API.Middleware.ApiResponseMiddleware.RequestIdHeader].FirstOrDefault() ?? Guid.NewGuid().ToString("N");

        var isDevelopment = app.Environment.IsDevelopment();
        var envelope = new Aquri.API.Common.ApiResponse<object>
        {
            Success = false,
            Error = new Aquri.API.Common.ApiError
            {
                Code = Aquri.API.Common.ErrorCodes.Internal,
                Message = isDevelopment && error?.Error is not null
                    ? error.Error.Message
                    : "An unexpected error occurred.",
                Details = isDevelopment ? error?.Error?.ToString() : null
            },
            Timestamp = DateTime.UtcNow,
            RequestId = requestId
        };
        await context.Response.WriteAsJsonAsync(envelope);
    });
});

// Response envelope: wraps every JSON API response in ApiResponse<T> and
// manages X-Request-ID. Must sit after the exception handler and before
// auth/controllers so 401/403 challenges are enveloped too.
app.UseMiddleware<Aquri.API.Middleware.ApiResponseMiddleware>();

// Swagger — documentation surface, Development only
if (app.Environment.IsDevelopment())
{
    app.UseSwagger();
    app.UseSwaggerUI(options =>
    {
        options.SwaggerEndpoint("/swagger/v1/swagger.json", "Aquri API V1");
        options.RoutePrefix = "swagger";
    });
}

if (!app.Environment.IsDevelopment())
    app.UseHsts();

app.UseHttpsRedirection();

app.UseCors("FrontendPolicy");

app.UseRateLimiter();

app.UseAuthentication();
app.UseAuthorization();

app.MapControllers();

// Lightweight liveness endpoint (no dependencies — always 200 if process is up)
app.MapGet("/health", () => Results.Ok(new { status = "Healthy", timestamp = DateTime.UtcNow }));

// Full readiness endpoint (includes database check)
app.MapHealthChecks("/health/ready");

// Idempotent seeding: creates demo users on first run (skips when they exist).
// Wrapped so the API still starts when the database is unreachable (e.g. tests).
try
{
    using var scope = app.Services.CreateScope();
    await DbSeeder.SeedAsync(scope.ServiceProvider, app.Configuration.GetValue<bool>("Seed:DemoUsers"));
}
catch (Exception ex)
{
    app.Logger.LogWarning(ex, "Database seeding skipped: {Message}", ex.Message);
}

app.Run();

// Exposes the auto-generated Program class to WebApplicationFactory-based integration tests.
public partial class Program { }
