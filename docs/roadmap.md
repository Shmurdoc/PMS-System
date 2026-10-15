# Roadmap

Seven slices. Slices 1–5 are done. Slice 6 is open; Slice 7 is in progress.

The north star: the React frontend (Zustand, 26 models, ~81 actions, 24 pages, 7 roles) started out on mock data with zero network calls. The backend grows to serve shapes compatible with those models, endpoint by endpoint. Frontend types are the contract; read `useAppStore.ts` before designing any entity or DTO.

## Slice 1 — Data-access consolidation — DONE

IApplicationDbContext with DbSets + SaveChangesAsync. No repository/UoW layer; the DbContext is the unit of work. Handlers query tracked entities and commit once. `Program.cs` registers the DbContext and maps the abstraction to the same instance per scope.

## Slice 2 — User + auth — DONE

User entity (private setters, constructor validation, domain methods). AppRoles (admin, manager, front_desk, housekeeping, maintenance, auditor). PBKDF2 hashing (100k iterations, SHA256, format `PBKDF2|{iterations}|{salt}|{hash}`). JwtTokenService (HMAC-SHA256, claims: id, email, name, role). AuthController: `POST /api/v1/auth/login`, `GET /api/v1/auth/me`. DbSeeder idempotently seeds admin/manager/front demo users; wrapped so the API starts even when Postgres is unreachable.

## Slice 3 — InitialCreate migration — DONE (apply blocked)

Migration generated via `AquriDbContextFactory` covers Properties, Rooms, MaintenanceRequests, Users. Applying to local Postgres fails with 28P01 (auth) — environment issue, not code. Documented in `getting-started.md`. Once credentials are fixed, `dotnet ef database update` applies cleanly.

## Slice 4 — Core entities — DONE

New Domain entities + EF mappings + migrations + MediatR slices + controllers, aligned to the frontend's interfaces:

- **Booking** — guest/property/room refs, check-in/out, nights, guests, status (`pending|confirmed|checked-in|checked-out|cancelled|no-show`), paymentStatus (`pending|partial|paid|refunded`), amount/rate/deposit/balance, source, specialRequests. Denormalized guestName/roomNumber on the DTO for list views; store FKs in the entity.
- **Guest** — identity + segment (`VIP|Frequent|New|Corporate`), loyalty (totalStays, loyaltyPoints, vipLevel), preferences[] and allergies[] (store as `text[]` or JSONB), notes, nationality, idNumber.
- **Invoice** + **InvoiceItem** — invoiceNumber, type (`booking|service|advance|final`), items, subtotal/taxAmount/discountAmount/total (decimal(18,2), ZAR, VAT 15%), status (`draft|pending|sent|paid|partial|overdue|cancelled|refunded`), dates.
- **Payment** — paymentNumber, method (`cash|card|eft|wire_transfer|mobile_money|voucher`), status, reference/transactionId, processedBy.
- **Ticket** + **TicketComment** — ticketNumber, type (`issue|task|request|incident`), category (front_desk/housekeeping/...), priority (low..critical), status (`open|in_progress|pending|resolved|closed|cancelled`), assignee/reporter, tags[], comments (separate entity, not embedded — frontend has a nested array but it is a one-to-many). isInternal on comments.

One vertical slice folder per feature under `Aquri.Application\` (see conventions). One migration covering all six (or a few grouped logically). Controllers with role gates matching the frontend's 7 roles.

## Slice 5 — Supporting entities — DONE

RatePlan, Expense, InventoryItem, Shift, AttendanceRecord, Message, AuditLog, and TaxConfig all landed — entity → mapping → migration (`AddSupportingEntities`) → handler slice → controller, same pattern throughout. The frontend is wired end to end for the five collections that were still on mocks: mappers, services, hydrate wave, and synced store actions for shifts, attendance, messages, audit logs, and tax configs.

Also on this slice's periphery: RfidTag, ElectricityRecord, Integration (frontend-only at the time; RfidTag has since landed end to end — see the Dual NFC section below). Workflow and AiInsight landed separately — see the AI agent layer section below.

## Slice 6 — FluentValidation pipeline

FluentValidation packages are already referenced (Application + Infrastructure) but not wired. Add validators per command/query, register them in DI, and either:

- Add a MediatR behavior that runs validators and converts failures to `Result.Failure`, or
- Call validators explicitly in handlers (simpler, no pipeline).

Pick one approach and apply it consistently. Until then, handlers do ad-hoc null/empty checks (see LoginHandler, CreateRoomHandler).

## Slice 7 — Documentation — IN PROGRESS

This docs folder is the start: architecture, conventions, getting-started, roadmap. Remaining: endpoint reference, deployment notes, and a root README (owned by a separate task — not this slice's deliverable from here).

## AI agent layer — DONE

Insights, workflows, agents, and chat are served from the backend now: `Aquri.Application\AiInsights\`, `AiWorkflows\`, `AiAgents\`, `AiChat\` behind `api/v1/{aiInsights,workflows,agents,chat}` (admin/manager, WS3 envelope). Chat is deterministic first — an LLM only joins in when `AI:ApiKey` is set, and nothing in the app or the test suite needs one. `DbSeeder` seeds 6 agents plus sample insights and workflows. Frontend is wired to all of it (4 tabs + drawer). 489 tests, all green.

## Dual NFC tags — DONE

One `RfidTag` entity serves both kinds: `staff` binds a User, `guest` binds a Booking, exactly one FK per row (migration `AddRfidTags`). Backend exposes `api/v1/RfidTags` — list (property-scoped), issue, revoke, and the two tap endpoints (`tap/staff`, `tap/guest`) that punch attendance or open a stay. The frontend is wired end to end: store contract + mocks, per-property hydration, guest tags shaped from Check-In/Out, and a Tap Station tab in RFID Management with manual UID entry as the always-available fallback plus an optional Web Serial reader (flag `VITE_NFC_READER=1`). Door-lock enforcement stays out of scope — tags identify, doors are not this system's job.

## Constraints to keep in mind

- Currency ZAR. VAT 15%. Tourism levy 1%. Frontend `AppSettings` holds the rates; tax rules live in the TaxConfig entity (Slice 5) rather than being hardcoded.
- Frontend role strings and status unions are the source of truth. Do not invent new status values; extend the union in the store first, then mirror.
- 26 Zustand models vs the entities landed (Properties, Rooms, Users, Bookings, Guests, Invoices, Payments, Tickets, RatePlans, Expenses, InventoryItems, MaintenanceRequests, Shift, Attendance, Message, AuditLog, TaxConfig, RfidTag + the AI layer). The deferred periphery is ElectricityRecord, Integration.
- Multi-tenancy: every Room belongs to a Property (`PropertyId`). New guest-scoped entities should carry `PropertyId` the same way.
