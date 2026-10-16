# Architecture

Aquri is a hotel property management system. .NET 8, EF Core 8, PostgreSQL. Five projects in `Aquri.sln`, wired as Clean Architecture. This doc explains the shape of the system and why it is cut where it is.

## The layers

```
Aquri.API            controllers, DI wiring, JWT auth, Swagger, Serilog
    |
    v
Aquri.Application    MediatR commands/queries/handlers, DTOs, Result,
    |                interfaces (IApplicationDbContext, IPasswordHasher, ITokenService)
    |
    v
Aquri.Domain         entities only. No EF, no framework deps.
    
Aquri.Infrastructure implements Application's interfaces: AquriDbContext,
    |                migrations, Pbkdf2PasswordHasher, JwtTokenService, DbSeeder
    v
  PostgreSQL

Aquri.Tests          xUnit + FluentAssertions + EF InMemory + WebApplicationFactory
```

Dependency rules, enforced by project references:

- Application references Domain. Nothing else.
- Infrastructure references Application and Domain.
- API references Application and Infrastructure. Never Domain directly.
- Domain references nothing.

These exist for two reasons. First, Domain stays a plain C# library, so entities can be unit-tested without a database or a web host. Second, Application only sees `IApplicationDbContext`, `IPasswordHasher`, and `ITokenService` — the concrete EF context, the PBKDF2 hasher, and the JWT service live in Infrastructure and are swapped at DI registration time. If you ever need to change the database or the token format, you change Infrastructure and Application does not move.

## How a request flows

Take `POST /api/v1/rooms`:

1. `RoomsController.Create` receives the command DTO from the body.
2. It calls `_mediator.Send(command)`.
3. MediatR resolves `CreateRoomHandler` from DI (scoped, same scope as the request).
4. The handler takes `IApplicationDbContext` and `IMapper` from its constructor.
5. It queries `Rooms` / `Properties` on the context, mutates or adds tracked entities, calls `SaveChangesAsync` once.
6. It returns `Result<RoomDto>.SuccessResult(dto)` or a failure.
7. The controller maps that to 201/200/400/404.

The DbContext registered as `IApplicationDbContext` is the same instance as `AquriDbContext` in a given scope (`Program.cs:93`). That is the unit of work: every mutation in one HTTP request commits in a single `SaveChangesAsync` call, one transaction. There is no repository layer and no `IUnitOfWork`. Handlers own their queries. If you find yourself wanting a repository, you probably want a narrower DbSet query or a projection instead.

## Where auth fits

Login is `POST /api/v1/auth/login`. The `LoginHandler` looks up the user by email, verifies the PBKDF2 hash via `IPasswordHasher`, and asks `ITokenService` for a JWT. The token carries `ClaimTypes.NameIdentifier`, `Email`, `Name`, and `Role`. Controllers enforce access with `[Authorize(Roles = "admin,manager")]` and friends — the role strings are the constants in `AppRoles` (Domain). `GET /api/v1/auth/me` reads the id claim back out and returns the profile.

Password hashing and token issuance are interfaces in Application (`IPasswordHasher`, `ITokenService`) implemented in Infrastructure (`Security\`). That keeps the crypto details out of the handlers and lets tests fake them.

`DbSeeder` runs at startup, wrapped in try/catch so the API boots even when Postgres is down (useful for tests and local work without a database). It is idempotent: it checks `Users.AnyAsync()` and exits if anything exists.

## The AI layer

Four AI features sit on the same vertical-slice pattern: insights (`AiInsights\`), workflows (`AiWorkflows\`), agents (`AiAgents\`), and chat (`AiChat\`), behind `api/v1/{aiInsights,workflows,agents,chat}` with `[Authorize(Roles = "admin,manager")]` and the standard envelope like everything else.

Chat is hybrid. `HybridChatClient` computes stats from the DbContext (occupancy, revenue, bookings — the numbers the frontend's AI tab shows) and answers through `DeterministicChatClient`, an intent router over those stats. When `AI:ApiKey` is set it first tries `{BaseUrl}/chat/completions` through the named `"ai"` HttpClient; a clean reply comes back as `source: "llm"`, anything else (timeout, 5xx, malformed JSON) drops to the deterministic answer. Empty key — the default — never opens a network call, so a fresh checkout and the whole test suite need no AI account. The key stays server-side: not logged, not in DTOs, not sent to the browser.

`DbSeeder` seeds six agents plus sample insights and workflows, in granular idempotent blocks (users, agents, insights, workflows each guard independently).

## Migrations

EF migrations live in `Aquri.Infrastructure\Persistence\Migrations\`. `AquriDbContextFactory` is the design-time factory so `dotnet ef migrations add` works without a running host. It hardcodes the same connection string as `appsettings.json` — update both when the connection string changes.

Applying migrations to a local Postgres currently fails with 28P01 (password authentication failed). This is an environment/credential issue, not a code issue. See `docs/getting-started.md`.

## Current shape vs where we are going

The codebase has moved past the foundation. Slices 1–3 built data access, auth, and the InitialCreate migration; Slice 4 landed the core entities (Booking, Guest, Invoice, Payment, Ticket); Slice 5 has landed every supporting entity — RatePlan, Expense, InventoryItem, Shift, AttendanceRecord, Message, AuditLog, TaxConfig — and the frontend is wired to all of them. Some older Application folders are still flat (`Rooms\Commands.cs`, `Rooms\Handlers.cs`, `DTOs\` as a dumping ground) while newer features use vertical slice folders (`Bookings\CreateBookingCommand.cs`, `Guests\`, `Invoices\`) with their DTOs next to the handler. See `docs/conventions.md` and `docs/roadmap.md`.

The frontend (React + Zustand, outside this repo) defines 26 models; Slices 4–5 closed that gap, entity by entity.

## Tests

Two kinds. Unit tests construct handlers with an EF InMemory context and assert on `Result`. Integration tests boot the real host via `WebApplicationFactory<Program>` and hit endpoints (or just resolve services). `DependencyInjectionTests` verifies the DbContext abstraction and MediatR wiring resolve correctly. Build treats warnings as errors everywhere except Application (which carries some NoWarn entries); nullable is on across the board.
