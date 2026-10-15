using Aquri.Infrastructure.Persistence;
using Microsoft.AspNetCore.Hosting;
using Microsoft.AspNetCore.Mvc.Testing;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.DependencyInjection;
using Microsoft.Extensions.DependencyInjection.Extensions;

namespace Aquri.Tests.Api
{
    /// <summary>
    /// Boots the real API host against an isolated EF InMemory database so
    /// HTTP-level tests can hit controllers end-to-end (envelope, auth, DI).
    /// DbSeeder runs on boot (Program.cs) against the same database — tests
    /// authenticate with the documented demo credentials.
    /// </summary>
    public class AquriApiFactory : WebApplicationFactory<Program>
    {
        private readonly string _databaseName = $"aquri-api-tests-{Guid.NewGuid():N}";

        protected override void ConfigureWebHost(IWebHostBuilder builder)
        {
            builder.ConfigureServices(services =>
            {
                var optionsDescriptor = services
                    .SingleOrDefault(d => d.ServiceType == typeof(DbContextOptions<AquriDbContext>));
                if (optionsDescriptor is not null)
                    services.Remove(optionsDescriptor);

                var contextDescriptor = services
                    .SingleOrDefault(d => d.ServiceType == typeof(AquriDbContext));
                if (contextDescriptor is not null)
                    services.Remove(contextDescriptor);

                services.AddDbContext<AquriDbContext>(options =>
                    options.UseInMemoryDatabase(_databaseName));
            });
        }
    }
}
