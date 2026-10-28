# Spec: Production Readiness for Real Properties with Real Money

## Objective

Make Aquri safe to operate at a live property handling real guest payments, payroll, and bookings. The system must not double-charge guests, double-book rooms, lose money on failed saves, or leak data across properties. Every money mutation must be atomic, idempotent, and auditable. Every scoped user (manager, front desk, housekeeping, maintenance) must be confined to exactly one property server-side.

## Scope

This spec covers the remaining production gaps identified in `PRODUCTION-AUDIT.md` and the prior authorization audit:

1. **P0 money path** — payment idempotency, booking double-booking race, optimistic-write rollback.
2. **P1 money lifecycle** — invoice status changes (send/cancel), payment record detachment, server-side audit rows.
3. **P1 isolation** — explicit property filters on all read handlers (defense in depth beyond EF filter).
4. **P2 operations** — pagination, rate limiting, backup/restore runbook, property switcher consistency.
5. **Domain model cleanup** — `Guest` role with no routes (finish or remove), multi-currency scaffolding.

Out of scope: multi-entity accounting, FX conversion, payslip PDF/email, GL posting, bank payment file export.

## Assumptions I'm Making

1. Database is PostgreSQL (Npgsql) — exclusion constraints and filtered indexes are supported.
2. Authentication is JWT bearer with `property_id` scope claim for scoped accounts.
3. Admin accounts are unscoped (`PropertyId = null`); all other roles are scoped to exactly one property.
4. The frontend is a SPA consuming the same API; frontend filters are UX only, never security boundaries.
5. "Real money" means ZAR for now; multi-currency is scaffolding (a `Currency` column already exists), not live FX.

## Six Core Areas

### 1. P0 — Payment Idempotency (P0-4)

**Problem:** `CreatePaymentHandler` inserts whatever the client sends. Double-click or retried HTTP creates two payment rows for the same money.

**Invariant:** No two successful payments shall carry the same client-supplied idempotency key for the same property.

**Design:**

`CreatePaymentCommand` gains an optional `IdempotencyKey` (string, max 200 chars).

```csharp
public record CreatePaymentCommand(
    int PropertyId,
    int GuestId,
    int? InvoiceId,
    int? BookingId,
    decimal Amount,
    string Method,
    string ProcessedBy,
    string? Reference = null,
    string? IdempotencyKey = null) : IRequest<Result<PaymentDto>>;
```

Handler logic:
1. If `IdempotencyKey` is supplied, query `Payments` for an existing row where `PropertyId == request.PropertyId` AND a new `IdempotencyKey` column equals the key AND `Status != 'failed'`.
   - If found, return `SuccessResult` with the existing payment's DTO (idempotent replay — same as first response).
   - If not found, proceed to create.
2. Add `IdempotencyKey` column to `Payments` table (nullable, unique index where not null).
3. Create and insert within a single `SaveChangesAsync` (already atomic via EF).

**Migration:** Add column `IdempotencyKey` (varchar 200, nullable) to `Payments`; add unique index `IX_Payments_IdempotencyKey` on `(PropertyId, IdempotencyKey)` with filter `IdempotencyKey IS NOT NULL`.

**Controller:** `PaymentsController.Create` accepts `IdempotencyKey` from body (already part of command). Frontend `createPayment` input gains optional `idempotencyKey`; UI generates one per payment attempt (UUIDv4) and retries reuse the same key.

**Edge cases:**
- Key reused with a *different* amount → still returns the original payment (idempotency key identifies the *attempt*, not the amount). The second call with different amount but same key returns the first payment, preventing double-charge. This is correct: the client should not reuse a key for a genuinely different payment.
- Key `null` or empty → no idempotency check (legacy behavior), but new UI always supplies one.
- Failed payment (status `Failed`) with a key → a later call with the same key may create a new payment (the key is scoped to non-failed statuses).

### 2. P0 — Booking Double-Booking Race (P0-3)

**Problem:** `CreateBookingHandler` checks `AnyAsync` for overlapping bookings on the same room, then inserts. Two concurrent requests both pass the check → same room double-booked.

**Invariant:** No two non-cancelled bookings for the same room may overlap in time.

**Design:**

**Primary fix — PostgreSQL exclusion constraint** (strongest, protects all code paths):

```sql
EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(check_in, check_out, '[)') WITH &&
) WHERE (status <> 'cancelled');
```

This is a database-level guarantee. Any insert/update that violates it throws a PostgreSQL exclusion-violation error (23514), which the middleware maps to 409 Conflict.

**Migration:** Add the exclusion constraint to the `Bookings` table using `migrationBuilder.Sql(...)`. Since EF Core doesn't have a fluent API for exclusion constraints, use raw SQL in the migration `Up()`, and drop it in `Down()`.

**Secondary fix — serializable transaction with retry** (defense in depth for providers that don't support exclusion constraints, and to give a clean error message):

Wrap the overlap check + insert in `Serializable` isolation with a retry loop (max 3 attempts). On serialization failure (40001), reload and retry.

**Controller/handler:** `CreateBookingHandler` returns 409 with a user-friendly message ("Room is already booked for those dates") when the exclusion constraint fires. Middleware already maps `DbUpdateException` to 409; refine to detect exclusion-violation specifically.

**Edge cases:**
- Back-to-back bookings (check-out == check-in of another) are allowed (`[)` range excludes the upper bound).
- A cancelled booking does not block re-booking the same dates (filter `WHERE status <> 'cancelled'`).
- Updating a booking's dates must also respect the constraint (handled by the DB constraint on UPDATE too).

### 3. P0 — Optimistic Write Rollback (P0-2)

**Problem:** `syncToApi` in `useAppStore.ts` catches API failure, shows a toast saying "the change stays on screen," and leaves the local row. On reload it disappears. For money this is worse than a hard failure.

**Invariant:** A failed money write must not leave the client believing it succeeded. The UI must roll back the optimistic update and surface the error clearly.

**Design:**

Modify `syncToApi` to accept an `onRollback` callback. Money-related store mutations (`createPayment`, `completePayment`, `refundPayment`, `createBooking`, `recordBookingDeposit`) pass a rollback function that reverts the local state.

```typescript
function syncToApi(
  label: string,
  task: () => Promise<unknown>,
  onOk?: (data: unknown) => void,
  onErr?: (error: unknown) => void,
  onRollback?: () => void
): void {
  if (!getAuthToken()) return;
  void task()
    .then((data) => onOk?.(data))
    .catch((error) => {
      console.warn(`[api] ${label} failed:`, error);
      onRollback?.(); // revert optimistic UI before showing error
      if (onErr) {
        onErr(error);
      } else {
        toast.error('Sync failed', { ... });
      }
    });
}
```

**Rollback examples:**
- `createPayment`: remove the optimistic payment row from `payments` array, restore any invoice `PaidAmount`/`Status` that was optimistically updated.
- `completePayment`/`refundPayment`: revert invoice `PaidAmount`/`Status` to pre-call values.
- `createBooking`: remove the optimistic booking, set room status back to `Available`.

**Frontend changes:**
- `useAppStore.ts`: add `onRollback` param to `syncToApi`.
- `createPayment`, `completePayment`, `refundPayment`, `createBooking`, `recordBookingDeposit`: pass rollback closures.
- Toast message for money failures: explicit ("Payment did not go through. No money was charged.") rather than generic.

### 4. P1 — Invoice Status Changes (P1-2)

**Problem:** Invoice status changes (send, cancel, mark paid) only happen in the local store. No API endpoint. A sent invoice reverts to draft on reload. `deletePayment` is local-only; no DELETE route exists.

**Invariant:** Invoice lifecycle transitions must be server-enforced via the domain `ChangeStatus` transition table, persisted in the same transaction as any related payment.

**Design:**

New endpoints on `InvoicesController`:

```csharp
[HttpPost("{id:int}/send")]
[Authorize(Roles = "admin,manager,front_desk")]
public async Task<IActionResult> Send(int id)

[HttpPost("{id:int}/cancel")]
[Authorize(Roles = "admin,manager")]
public async Task<IActionResult> Cancel(int id)

[HttpDelete("{id:int}/payments/{paymentId:int}")]
[Authorize(Roles = "admin,manager")]
public async Task<IActionResult> DetachPayment(int id, int paymentId)
```

New commands:
- `SendInvoiceCommand(int Id, string? SentBy)` → `invoice.ChangeStatus(InvoiceStatus.Sent)` (transition Draft→Sent or Pending→Sent).
- `CancelInvoiceCommand(int Id, string? CancelledBy)` → `invoice.ChangeStatus(InvoiceStatus.Cancelled)`; detaches any linked payments (sets their `InvoiceId = null`, status stays as-is; payments are not destroyed for audit).
- `DetachPaymentCommand(int InvoiceId, int PaymentId)` → load payment, verify it belongs to this invoice, set `InvoiceId = null`.

**Guard:** `RecordPayment`/`ReversePayment` on an invoice that is `Cancelled` or `Refunded` already throws (domain guard). Good.

**Frontend:** `updateInvoice` / new `sendInvoice`, `cancelInvoice`, `detachPayment` API calls; store actions replace optimistic-only updates with server round-trips.

### 5. P1 — Server-Side Audit Trail (P1-1)

**Problem:** Pages call `addAuditLog` locally; most API commands write no `AuditLog` row. Any API client bypasses the trail.

**Invariant:** Every create/update/delete on money and staff entities must write a server-side `AuditLog` row in the same transaction.

**Design:**

The `AuditLog` entity already exists (`AquriDbContext` line 53). Add a reusable audit-writing helper:

```csharp
public static class AuditTrail
{
    public static void Write(
        AquriDbContext context,
        ICurrentUser currentUser,
        string action,
        string entityType,
        string entityId,
        string entityName,
        string? oldValue = null,
        string? newValue = null)
    {
        var log = new AuditLog(
            action,
            entityType,
            entityId,
            entityName,
            currentUser.UserId,
            currentUser.UserName,
            currentUser.UserRole,
            currentUser.PropertyId,
            oldValue,
            newValue);
        context.AuditLogs.Add(log);
    }
}
```

`AuditLog` constructor needs a `PropertyId` parameter (currently it has `PropertyId` property via EF but check constructor). Let me check — from the migration, `AuditLog` has `PropertyId` FK. The entity constructor likely doesn't take it. Add `int? propertyId` to `AuditLog` constructor.

Call sites (in handlers, within the same `SaveChangesAsync`):
- `CreateUserHandler`, `UpdateUserHandler`, `DeleteUserHandler`
- `CreateBookingHandler`, `UpdateRoomHandlers` (status/price), `DeleteRoomHandler`
- `CreateInvoiceHandler`, `SendInvoiceHandler`, `CancelInvoiceHandler`, `DetachPaymentHandler`
- `CreatePaymentHandler`, `CompletePaymentHandler`, `RefundPaymentHandler`
- `CreatePayrollRunHandler`, `ApprovePayrollRunHandler`, `PayPayrollRunHandler`, `CancelPayrollRunHandler`
- `CreatePropertyWithRoomsHandler`, `UpdatePropertyDetailsHandler`, `DeletePropertyHandler`

**Edge cases:**
- Audit write failure must fail the whole transaction (it's in the same `SaveChanges`, so it will).
- `AuditLog` reads are scoped by EF filter to the caller's property (already configured line 620).

### 6. P1 — Explicit Property Filters on All Read Handlers

**Problem:** Defense in depth — some read handlers (`GetPaymentsHandler`, `GetInvoicesHandler`, `GetUserHandler` previously) rely solely on the EF global query filter. If bypassed, data leaks across properties.

**Invariant:** Every read handler for a property-scoped entity must apply an explicit `.Where(e => e.PropertyId == scope)` for non-admin callers, in addition to the EF filter.

Already done for `GetUsersQuery`. Still needed:
- `GetPaymentsHandler` — add `ICurrentUser`, filter non-admin to scope.
- `GetInvoicesHandler` — add `ICurrentUser`, filter non-admin to scope.
- `GetBookingsHandler` — check and add.
- `GetRoomsHandler` — check and add.
- `GetGuestsHandler` — check and add.
- All `Get*ById` handlers — add explicit property filter so ID probing across properties returns 404, not data.

### 7. P2 — Pagination

**Problem:** No pagination on any list endpoint. A property with years of bookings loads everything into memory.

**Invariant:** All list endpoints return paginated results with `page`, `pageSize`, `totalCount`, and `totalPages`.

**Design:**
- Introduce `PagedResult<T>` wrapper: `List<T> Data, int TotalCount, int Page, int PageSize, int TotalPages`.
- All list queries accept `int page = 1, int pageSize = 50` (max 200).
- Apply `.Skip((page-1)*pageSize).Take(pageSize)` and `.CountAsync()` separately.
- Frontend store list actions accept pagination params and store `totalCount`.

### 8. P2 — Rate Limiting

**Problem:** No rate limiting on login or payment endpoints (P0-3 in audit said login is rate-limited but let me verify). Actually audit says "No rate limiting on login or payment endpoints" but `Program.cs` shows rate limiting on auth. Let me re-check... The audit P0-3 says "No rate limiting on login or payment endpoints" but `Program.cs:106-124` has auth rate limiting. The audit may be outdated. Ensure payment endpoints also have rate limiting.

**Design:**
- Add rate limit policy "payments" (per IP, fixed window 10/min) applied via `[EnableRateLimiting("payments")]` on `Create`, `Complete`, `Refund`.
- Keep existing "auth" policy on login.

### 9. P2 — Guest Role Cleanup

**Problem:** `Guest` role exists in `AppRoles` and `ROLE_PERMISSIONS` but has no routes (audit P1-7).

**Design:** Either finish it (guest portal routes: view own bookings, check-in) or remove it. Given this is a staff-facing PMS, remove `Guest` from `AppRoles.All` and `ROLE_PERMISSIONS` to avoid confusion, OR mark it as "reserved for future guest portal." Recommendation: remove from active roles to prevent accidental assignment; keep the constant for future use but exclude from `All`.

### 10. P2 — Property Switcher Consistency

**Problem:** Property switcher only drives the dashboard; other pages resolve from `me.propertyId` or first property (audit P1-3).

**Design:** For scoped users (non-admin), the switcher is removed/hidden — they see only their assigned property. For admins, the switcher updates a global `selectedPropertyId` that all list pages respect (with pagination). Document that the switcher is admin-only; scoped users are locked to their property server-side regardless of UI.

### 11. Domain — Multi-Currency Scaffolding

`Currency` column exists on `Payment`, `Invoice`, `PayrollRun`, `EmployeeCompensation`. Default "ZAR". No FX. This is fine for single-region; add a `Property.Currency` column so each property has its own default currency, and new payments/invoices inherit it. No conversion logic (out of scope).

## Tech Stack

- Backend: .NET 8, ASP.NET Core, EF Core, Npgsql/PostgreSQL, MediatR, FluentValidation, AutoMapper, Serilog.
- Frontend: React, TypeScript, Zustand, TanStack Query (or existing zustand), lucide-react, framer-motion.
- Tests: xUnit, FluentAssertions, WebApplicationFactory integration tests (existing), Vitest for frontend.

## Commands

```
Build: dotnet build Aquri.sln
Test: dotnet test Aquri.Tests/Aquri.Tests.csproj
Frontend typecheck: npx tsc --noEmit (in frontend/)
Migration: dotnet ef migrations add <Name> (in Aquri.API/)
```

## Project Structure (changed files)

```
Aquri.Domain/Entities/Payment.cs          → IdempotencyKey not on entity (column only)
Aquri.Domain/Entities/AuditLog.cs          → Add propertyId to constructor
Aquri.Application/Common/AuditTrail.cs     → NEW
Aquri.Application/Payments/CreatePaymentCommand.cs → IdempotencyKey param
Aquri.Application/Payments/PaymentCommands.cs      → Complete/Refund idempotent replay
Aquri.Application/Invoices/SendInvoiceCommand.cs   → NEW
Aquri.Application/Invoices/CancelInvoiceCommand.cs → NEW
Aquri.Application/Invoices/DetachPaymentCommand.cs → NEW
Aquri.Application/Users/GetUsersQuery.cs           → DONE (explicit filter)
Aquri.API/Controllers/PaymentsController.cs        → idempotency key, rate limit
Aquri.API/Controllers/InvoicesController.cs        → send/cancel/detach-payment
Aquri.Infrastructure/Persistence/Migrations/<new>  → idempotency key, exclusion constraint, property currency
frontend/src/store/useAppStore.ts                  → syncToApi onRollback, money rollbacks
frontend/src/pages/AdminPanel.tsx                  → DONE (manager scoping)
frontend/src/lib/rbac.ts                           → DONE (manager manageUsers)
```

## Testing Strategy

**Backend (xUnit + WebApplicationFactory):**
- `CreatePayment` with same idempotency key twice → returns same payment, 1 row in DB.
- `CreatePayment` with same key, different amount → returns first payment (no double charge).
- `CreateBooking` concurrent overlap → second gets 409.
- `CreateBooking` back-to-back dates → allowed (201).
- `CreateUser` as manager at another property → 403.
- `GetUsers` as manager → only own property's users.
- `GetUserById` as manager for another property's user → 404.
- Invoice send/cancel transitions enforced server-side; invalid transition → 409.
- AuditLog row created on `CreatePayment`, `CompletePayment`, `CancelInvoice`.

**Frontend (Vitest / existing test setup):**
- `syncToApi` rollback reverts optimistic payment on failure.
- AdminPanel property dropdown shows only manager's own property.

## Boundaries

- **Always do:** Run `dotnet build` and `dotnet test` before committing; validate all inputs at API boundary; keep money mutations in a single `SaveChangesAsync`; scope every read by property for non-admin.
- **Ask first:** Adding new NuGet packages; changing JWT claim shape; modifying `User.AssignProperty` or `ChangeRole`; adding new entity types.
- **Never do:** Commit secrets or connection strings; edit vendor directories; remove failing tests without approval; write audit logs client-side only.

## Success Criteria

1. Build: 0 warnings, 0 errors.
2. Backend tests: all pass (existing 552 + new money/isolation tests).
3. Frontend: `tsc --noEmit` clean.
4. No payment can be created twice with the same idempotency key.
5. No two non-cancelled bookings overlap on the same room (DB-enforced).
6. Failed money write rolls back optimistic UI and shows explicit error.
7. Invoice send/cancel/detach-payment work via API and persist across reload.
8. Server-side AuditLog row written for every money/staff mutation.
9. All list endpoints paginated; rate limiting on payments + auth.
10. Non-admin users confined to one property on every read handler (explicit filter + EF filter).

## Open Questions

1. Should `Guest` role be removed from `AppRoles.All` now, or kept for a future guest portal? (Recommendation: remove from `All`, keep constant.)
2. Should rate limiting be per-IP or per-user+IP? (Recommendation: per-IP for simplicity, matches existing auth policy.)
3. What is the default `pageSize` and max? (Recommendation: 50 default, 200 max.)
4. Should `CancelInvoice` also refund linked payments automatically, or just detach them? (Recommendation: detach only; refunds are explicit actions.)

---

Please review this spec. If you approve, I'll write the implementation plan (tasks) next, then implement incrementally.