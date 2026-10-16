# Aquri — Property Management System

A clean-architecture backend for a hospitality PMS: properties, rooms, guests, bookings, invoicing, payments, and day-to-day operations (tickets, staff, inventory). Money is **ZAR** with **15% VAT** and a **1% tourism levy**. Multi-tenant by `PropertyId`.

- Stack: **.NET 8**, **EF Core (PostgreSQL)**, **MediatR** (vertical slices), **JWT** auth.
- Layers: `Domain` → `Application` → `Infrastructure` → `API`. `Application` depends only on `Domain`; nothing flows the wrong way.
- Tests: **xUnit** + EF InMemory — **504 passing**.

## Getting started

```bash
# restore + build
dotnet build Aquri.sln

# run tests (redirect TEMP if NuGet scratch hits a lock error)
$env:TEMP="C:\Temp"; $env:TMP="C:\Temp"; dotnet test Aquri.sln

# run the API
dotnet run --project Aquri.API
```

Connection string and `Jwt:Key` are not committed: `appsettings.json` ships empty and `Program.cs` fails fast when either is missing. Set them in `Aquri.API/appsettings.Development.json` (gitignored) or env vars (`ConnectionStrings__DefaultConnection`, `Jwt__Key`); Docker reads `.env` (copy `.env.example`).

Demo logins: `admin@nexus.com`/`admin123`, `manager@nexus.com`/`manager123`, `front@nexus.com`/`front123`.

## API surface

Base route: `/api/v1/...` (versioned, `[Authorize]` by default, per-action role checks). Endpoints:

| Area | Routes |
|------|--------|
| Auth | `POST /api/v1/auth/login`, `POST /api/v1/auth/register` |
| Properties | CRUD |
| Rooms | CRUD + status/price transitions |
| Guests | CRUD + search |
| Bookings | create, list, get, status transitions |
| Invoices | create, get, list, add item, record payment |
| Payments | create, complete, refund, list |
| Tickets | create, get, list, status, assign, comment |
| RFID | `GET/POST /api/v1/RfidTags`, `POST .../{id}/revoke`, `POST .../tap/staff`, `POST .../tap/guest` |
| AI | `aiInsights`, `aiWorkflows`, `aiAgents`, `aiChat` |

Roles (`AppRoles`): `admin`, `manager`, `front_desk`, `housekeeping`, `maintenance`, `auditor`.

## Data model

25 entities, seven migrations (`InitialCreate`, `AddCoreEntities`, `AddSupportingEntities`, `AddNumberSequences`, `DropOrphanNavigationForeignKeys`, `AddAiAgentLayer`, `AddRfidTags`). Core: `Property`, `Room`, `Guest`, `Booking`, `Invoice`(+`InvoiceItem`), `Payment`, `User`, `Ticket`(+`TicketComment`). Supporting: rate plans, expenses, inventory, shifts, attendance, messages, audit logs, tax configs, number sequences, RFID tags, the AI layer (insights, workflows, agents, logs).

Statuses are guarded by static transition tables on the entities (`Booking.CanTransitionTo`, `Ticket.CanTransitionTo`, …) so handlers can't reach a nonsense state. Handlers never assign navigation properties directly (private setters); they load with `Include` and read via `?.`.

## Conventions

- Handlers return `Result` / `Result<T>` (`Ok` / `Failure` / `NotFound`), never throw for business rules.
- One command/query per file, grouped by feature folder (vertical slices). DTOs live beside their feature with a `FromEntity` mapper.
- Controllers: thin, DI `IMediator`, string-bodied `BadRequest(result.Error)` on failure, three-branch `NotFound` → `BadRequest` → `Ok` on reads.
- IDs for human documents are generated as strings (`INV-2026-00042`, `PAY-…`, `TKT-…`).

See `docs/architecture.md`, `docs/conventions.md`, `docs/getting-started.md`, and `docs/roadmap.md`.

## Known follow-ups

- Both AutoMapper and Mapster are referenced — pick one.
- No auto-migrate on startup (intentional for now).
- Applying migrations to local Postgres still hits `28P01` — environment, see `docs/getting-started.md`.
