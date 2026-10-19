# Getting Started

## Prerequisites

- .NET 8 SDK
- PostgreSQL (local or Docker) — database `Aquri`, user `aquri_user`. No default password ships; set one when you configure the connection string (below).
- Optional: a Postgres admin user to create `aquri_user` and grant rights

## Build

```
dotnet build Aquri.sln
```

Build is clean. `TreatWarningsAsErrors` is on for Domain, Infrastructure, API, and Tests; Application suppresses a few NuGet warnings (`NU1507`, `NU1605`, `NU1903`). Nullable is enabled everywhere.

## Test

```
dotnet test
```

448 tests, all passing. Three kinds:

- Unit tests: construct handlers with an EF InMemory `AquriDbContext`, assert on `Result`.
- Integration tests: `WebApplicationFactory<Program>` boots the real host (DI, health endpoint, MediatR resolution). No live database needed — seeding fails gracefully and the host still starts.
- HTTP envelope tests: `AquriApiFactory` swaps the DbContext to a per-instance EF InMemory database (so the demo users seed), then hits real endpoints with auth tokens and asserts the `ApiResponse` envelope contract — success/error codes, `X-Request-ID` echo, timestamps, and the unwrapped paths (`/health`, `/swagger`).

## Run the API

```
dotnet run --project Aquri.API
```

Swagger at `/swagger`. Health at `/health` (liveness) and `/health/ready` (includes Postgres check).

## Connection string

No credentials ship in the repo — `appsettings.json` has empty `ConnectionStrings` and `Jwt:Key`, and the API fails fast when either is missing. Supply both locally:

- `Aquri.API\appsettings.Development.json` (gitignored) — plain JSON: `"DefaultConnection": "Host=localhost;Database=Aquri;Username=aquri_user;Password=<your password>"`, plus a `Jwt:Key` of 32+ characters.
- Environment variables — `ConnectionStrings__DefaultConnection` and `Jwt__Key`. Docker compose reads them from `.env` (copy `.env.example`).

The design-time factory (`AquriDbContextFactory`) resolves `ConnectionStrings__DefaultConnection` first, then config — migrations and the API share one source.

## AI (LLM) config

`Aquri.API\appsettings.json`:

```json
"AI": {
  "BaseUrl": "https://api.deepseek.com",
  "Model": "deepseek-flash",
  "ApiKey": "",
  "TimeoutSeconds": 15
}
```

`ApiKey` ships empty — chat answers deterministically from the live database and no outbound AI call is ever made. Set a key to enable LLM replies (env override works too):

```
$env:AI__ApiKey = "sk-..."
```

Nemotron is a drop-in alternative — same OpenAI-compatible protocol, swap two values:

| | DeepSeek (default) | Nemotron 3.5 |
|---|---|---|
| BaseUrl | `https://api.deepseek.com` | `https://integrate.api.nvidia.com/v1` |
| Model | `deepseek-flash` | `nvidia/nemotron-3.5-lightning-30b-a3b` |

Timeout, 5xx, or a malformed response falls back to the deterministic answer, so a bad or missing key never breaks chat.

## Demo logins

`DbSeeder` creates three users on first run when demo seeding is enabled (`Seed:DemoUsers=true`; skipped if any user already exists):

| Email               | Password    | Role       |
|---------------------|-------------|------------|
| admin@nexus.com     | admin123    | admin      |
| manager@nexus.com   | manager123  | manager    |
| front@nexus.com     | front123    | front_desk |

`POST /api/v1/auth/login` with `{ "email": "admin@nexus.com", "password": "admin123" }` returns a JWT. Use it as `Authorization: Bearer {token}`.

## Applying migrations

EF migrations are in `Aquri.Infrastructure\Persistence\Migrations\`, in order: `InitialCreate` (Properties, Rooms, MaintenanceRequests, Users), `AddCoreEntities`, `AddSupportingEntities`, `AddNumberSequences`, `DropOrphanNavigationForeignKeys`, `AddAiAgentLayer`, `AddRfidTags`, `AddUserPropertyScope`, `MakeRfidTagIndexActiveOnly`, `AddElectricityAndIntegrations`.

To apply against a live database:

1. Make sure Postgres is running and `aquri_user` exists with password auth matching the connection string.
2. Either run the API (it does not auto-migrate; check startup logs) or run `dotnet ef database update --project Aquri.Infrastructure --startup-project Aquri.API`.
3. To generate a new migration after model changes: `dotnet ef migrations add {Name} --project Aquri.Infrastructure --startup-project Aquri.API`. The design-time factory (`AquriDbContextFactory`) supplies the connection context.

### Note on the old 28P01 blocker

An earlier version of this page said `dotnet ef database update` always failed with `28P01: password authentication failed for user "aquri_user"` — credentials in the connection string didn't match the role in Postgres. That's sorted now: the dev config and the `aquri-db` container agree, and a full `database update` applies all ten migrations cleanly (verified 2026-10-19). If you do hit 28P01 on a fresh box, the fix is the same as it ever was — either `CREATE ROLE aquri_user WITH LOGIN PASSWORD '<your password>';` or point the connection string at credentials your Postgres accepts (the design-time factory picks the value up automatically).

## Project layout (quick reference)

```
Aquri.Domain\Entities\           Property, Room, MaintenanceRequest, User (+ AppRoles)
Aquri.Application\Common\        Result.cs, IApplicationDbContext.cs, interfaces
Aquri.Application\Auth\          LoginCommand, GetCurrentUserQuery
Aquri.Application\Rooms\         Queries, RoomLifecycle/UpdateRoom commands + handlers
Aquri.Application\Properties\    CreateProperty, UpdatePropertyStatus, Queries
Aquri.Application\RfidTags\      issue, revoke, staff tap, guest tap, list (DTOs beside each feature)
Aquri.Infrastructure\Persistence\ AquriDbContext, Migrations, DbSeeder, design-time factory
Aquri.Infrastructure\Security\   Pbkdf2PasswordHasher, JwtTokenService
Aquri.API\Controllers\           AuthController, BookingsController, RfidTagsController, …
Aquri.Tests\                     unit + integration tests
```

## Next

Read `docs/architecture.md` for the layer rules and request flow. Read `docs/conventions.md` before writing new code. `docs/roadmap.md` has the slice plan.
