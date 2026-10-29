# Spec: Production Readiness for Real Properties with Real Money

## Objective

Make Aquri safe to run at a live property handling real guest payments, payroll, and bookings. The system must not double-charge guests, double-book rooms, lose money on failed saves, or leak data across properties. Every money mutation must be atomic, idempotent, and auditable. Every scoped user (manager, front desk, housekeeping, maintenance) must be confined to exactly one property server-side.

## Scope

This spec covers the remaining production gaps found in `PRODUCTION-AUDIT.md` and the authorization audit:

1. P0 money path - payment idempotency, booking double-booking race, optimistic-write rollback.
2. P1 money lifecycle - invoice status changes (send/cancel), payment record detachment, server-side audit rows.
3. P1 isolation - explicit property filters on all read handlers, beyond the EF filter.
4. P2 operations - pagination, rate limiting, backup/restore runbook, property switcher consistency.
5. Domain model cleanup - `Guest` role with no routes (finish or remove), multi-currency scaffolding.

Out of scope: multi-entity accounting, FX conversion, payslip PDF/email, GL posting, bank payment file export.

## Assumptions

1. Database is PostgreSQL (Npgsql) - exclusion constraints and filtered indexes are supported.
2. Authentication is JWT bearer with a `property_id` scope claim for scoped accounts.
3. Admin accounts are unscoped (`PropertyId = null`); all other roles are scoped to exactly one property.
4. The frontend is a SPA consuming the same API. Frontend filters are UX only, never security boundaries.
5. "Real money" means ZAR for now. Multi-currency is scaffolding (a `Currency` column already exists), not live FX.

## Core Areas

### 1. Payment Idempotency

**Problem:** `CreatePaymentHandler` inserts whatever the client sends. A double-click or retried HTTP request creates two payment rows for the same money.

**Invariant:** No two successful payments carry the same client-supplied idempotency key for the same property.

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

1. If `IdempotencyKey` is supplied, query `Payments` for an existing row where `PropertyId` matches, the `IdempotencyKey` column equals the key, and `Status != 'failed'`.
   - If found, return `SuccessResult` with the existing payment's DTO (idempotent replay).
   - If not found, proceed to create.
2. Add `IdempotencyKey` column to `Payments` (nullable, unique index where not null).
3. Create and insert within a single `SaveChangesAsync` (already atomic via EF).

**Migration:** Add column `IdempotencyKey` (varchar 200, nullable) to `Payments`; add unique index `IX_Payments_IdempotencyKey` on `(PropertyId, IdempotencyKey)` with filter `IdempotencyKey IS NOT NULL`.

**Controller:** `PaymentsController.Create` accepts `IdempotencyKey` from the body (already part of the command). The frontend `createPayment` input gains an optional `idempotencyKey`; the UI generates one per payment attempt (UUIDv4) and retries reuse the same key.

**Edge cases:**

- Key reused with a different amount: returns the original payment. An idempotency key identifies the attempt, not the amount. A second call with a different amount but the same key returns the first payment, preventing a double-charge. The client should not reuse a key for a genuinely different payment.
- Key null or empty: no idempotency check (legacy behavior). The new UI always supplies one.
- Failed payment (status `Failed`) with a key: a later call with the same key may create a new payment. The key is scoped to non-failed statuses.

### 2. Booking Double-Booking Race

**Problem:** `CreateBookingHandler` checks `AnyAsync` for overlapping bookings on the same room, then inserts. Two concurrent requests both pass the check, so the same room gets double-booked.

**Invariant:** No two non-cancelled bookings for the same room overlap in time.

**Design:**

Primary fix - PostgreSQL exclusion constraint. This is the strongest option because it protects all code paths:

```sql
EXCLUDE USING gist (
    room_id WITH =,
    tstzrange(check_in, check_out, '[)') WITH &&
) WHERE (status <> 'cancelled');
```

This is a database-level guarantee. Any insert or update that violates it throws a PostgreSQL exclusion-violation error (23514), which the middleware maps to 409 Conflict.

**Migration:** Add the exclusion constraint to the `Bookings` table using `migrationBuilder.Sql(...)`. EF Core has no fluent API for exclusion constraints, so use raw SQL in the migration `Up()`, and drop it in `Down()`.

Secondary fix - serializable transaction with retry. This protects providers that do not support exclusion constraints and gives a clean error message. Wrap the overlap check and insert in `Serializable` isolation with a retry loop (max 3 attempts). On serialization failure (40001), reload and retry.

**Controller/handler:** `CreateBookingHandler` returns 409 with a user-friendly message ("Room is already booked for those dates") when the exclusion constraint fires. Middleware already maps `DbUpdateException` to 409; refine it to detect exclusion-violation specifically.

**Edge cases:**

- Back-to-back bookings (check-out equals check-in of another) are allowed. The `[)` range excludes the upper bound.
- A cancelled booking does not block re-booking the same dates (filter `WHERE status <> 'cancelled'`).
- Updating a booking's dates must also respect the constraint. The DB constraint handles UPDATE too.

### 3. Optimistic Write Rollback

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

- `createPayment`: remove the optimistic payment row from `payments`, restore any invoice `PaidAmount`/`Status` that was optimistically updated.
- `completePayment`/`refundPayment`: revert invoice `PaidAmount`/`Status` to pre-call values.
- `createBooking`: remove the optimistic booking, set room status back to `Available`.

**Frontend changes:**

- `useAppStore.ts`: add `onRollback` param to `syncToApi`.
- `createPayment`, `completePayment`, `refundPayment`, `createBooking`, `recordBookingDeposit`: pass rollback closures.
- Toast message for money failures: explicit ("Payment did not go through. No money was charged.") rather than generic.

### 4. Invoice Status Changes

**Problem:** Invoice status changes (send, cancel) only happen in the local store. No API endpoint exists. A sent invoice reverts to draft on reload. `deletePayment` is local-only; no DELETE route exists.

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

- `SendInvoiceCommand(int Id, string? SentBy)` - calls `invoice.ChangeStatus(InvoiceStatus.Sent)` (transition Draft→Sent or Pending→Sent).
- `CancelInvoiceCommand(int Id, string? CancelledBy)` - calls `invoice.ChangeStatus(InvoiceStatus.Cancelled)`, detaches linked payments (sets their `InvoiceId = null`, status unchanged; payments are not destroyed for audit).
- `DetachPaymentCommand(int InvoiceId, int PaymentId)` - load payment, verify it belongs to this invoice, set `InvoiceId = null`.

**Guard:** `RecordPayment`/`ReversePayment` on an invoice that is `Cancelled` or `Refunded` already throws (domain guard).

**Frontend:** `updateInvoice` plus new `sendInvoice`, `cancelInvoice`, `detachPayment` API calls. Store actions replace optimistic-only updates with server round-trips.

### 5. Server-Side Audit Trail

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

The `AuditLog` constructor needs a `PropertyId` parameter. Add `int? propertyId` to the constructor.

Call sites (in handlers, within the same `SaveChangesAsync`):

- `CreateUserHandler`, `UpdateUserHandler`, `DeleteUserHandler`
- `CreateInvoiceHandler`, `SendInvoiceHandler`, `CancelInvoiceHandler`, `DetachPaymentHandler`
- `CreatePaymentHandler`, `CompletePaymentHandler`, `RefundPaymentHandler`
- `CreatePayrollRunHandler`, `ApprovePayrollRunHandler`, `PayPayrollRunHandler`, `CancelPayrollRunHandler`
- `CreatePropertyWithRoomsHandler`, `UpdatePropertyDetailsHandler`, `DeletePropertyHandler`
- `CreateBookingHandler`

**Status:** Implemented for users, payments, invoices, payroll runs, properties, and booking creation. Not yet covered: expense submission/approval, inventory changes, room status changes, rate-plan writes, ticket writes, and payroll compensation changes. Expense submission is a money path and is the next priority.

**Edge cases:**

- Audit write failure fails the whole transaction (it is in the same `SaveChanges`).
- `AuditLog` reads are scoped by EF filter to the caller's property (already configured line 620).

### 6. Explicit Property Filters on All Read Handlers

**Problem:** Some read handlers (`GetPaymentsHandler`, `GetInvoicesHandler`, `GetUserHandler`) rely solely on the EF global query filter. If bypassed, data leaks across properties.

**Invariant:** Every read handler for a property-scoped entity must apply an explicit `.Where(e => e.PropertyId == scope)` for non-admin callers, in addition to the EF filter.

Already done for `GetUsersQuery`. Still needed:

- `GetPaymentsHandler` - add `ICurrentUser`, filter non-admin to scope.
- `GetInvoicesHandler` - add `ICurrentUser`, filter non-admin to scope.
- `GetBookingsHandler` - check and add.
- `GetRoomsHandler` - check and add.
- `GetGuestsHandler` - check and add.
- All `Get*ById` handlers - add explicit property filter so ID probing across properties returns 404, not data.

### 7. Pagination

**Problem:** No pagination on any list endpoint. A property with years of bookings loads everything into memory.

**Status:** Deferred. An initial PagedResult implementation was reverted (commit 7aed150) because it changed GET list responses from `data: [...]` to `data: { ... }`, which broke the API envelope contract the frontend and API tests rely on. Pagination needs to be re-designed non-breaking (response headers like `X-Total-Count`, or a versioned envelope) before it can land.

**Invariant (target):** List endpoints bound memory usage for large datasets.

### 8. Rate Limiting

**Problem:** No rate limiting on payment endpoints. Login already has rate limiting (`Program.cs:106-124`).

**Design:**

- Add rate limit policy "payments" (per IP, fixed window 10/min) applied via `[EnableRateLimiting("payments")]` on `Create`, `Complete`, `Refund`.
- Keep existing "auth" policy on login.

### 9. Guest Role Cleanup

**Problem:** `Guest` role exists in `AppRoles` and `ROLE_PERMISSIONS` but has no routes.

**Design:** Either finish it (guest portal routes: view own bookings, check-in) or remove it. This is a staff-facing PMS. Remove `Guest` from `AppRoles.All` and `ROLE_PERMISSIONS` to avoid confusion, or mark it as "reserved for future guest portal." Recommendation: remove from active roles to prevent accidental assignment. Keep the constant for future use but exclude from `All`.

### 10. Property Switcher Consistency

**Problem:** Property switcher only drives the dashboard; other pages resolve from `me.propertyId` or first property.

**Design:** For scoped users (non-admin), remove or hide the switcher - they see only their assigned property. For admins, the switcher updates a global `selectedPropertyId` that all list pages respect (with pagination). Document that the switcher is admin-only; scoped users are locked to their property server-side regardless of UI.

### 11. Multi-Currency Scaffolding

`Currency` column exists on `Payment`, `Invoice`, `PayrollRun`, `EmployeeCompensation`. Default "ZAR". No FX. This is fine for single-region. Add a `Property.Currency` column so each property has its own default currency. New payments and invoices inherit it. No conversion logic (out of scope).

## Tech Stack

- Backend: .NET 8, ASP.NET Core, EF Core, Npgsql/PostgreSQL, MediatR, FluentValidation, AutoMapper, Serilog.
- Frontend: React, TypeScript, Zustand, TanStack Query, lucide-react, framer-motion.
- Tests: xUnit, FluentAssertions, WebApplicationFactory integration tests, Vitest for frontend.

## Commands

```
Build: dotnet build Aquri.sln
Test: dotnet test Aquri.Tests/Aquri.Tests.csproj
Frontend typecheck: npx tsc --noEmit (in frontend/)
Migration: dotnet ef migrations add <Name> (in Aquri.API/)
```

## Project Structure

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

**Frontend:** no unit test harness exists yet (no Vitest/Jest setup, zero
`*.test.ts(x)` files), so the rollback behaviour and the manager-scoped
property dropdown are verified only by `tsc -b` and the production build,
not by tests. Adding a frontend test harness is outstanding work.

## Boundaries

- **Always do:** Run `dotnet build` and `dotnet test` before committing. Validate all inputs at API boundary. Keep money mutations in a single `SaveChangesAsync`. Scope every read by property for non-admin.
- **Ask first:** Adding new NuGet packages. Changing JWT claim shape. Modifying `User.AssignProperty` or `ChangeRole`. Adding new entity types.
- **Never do:** Commit secrets or connection strings. Edit vendor directories. Remove failing tests without approval. Write audit logs client-side only.

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

1. Should `Guest` role be removed from `AppRoles.All` now, or kept for a future guest portal? Recommendation: remove from `All`, keep the constant.
2. Should rate limiting be per-IP or per-user+IP? Recommendation: per-IP for simplicity, matches existing auth policy.
3. What is the default `pageSize` and max? Recommendation: 50 default, 200 max.
4. Should `CancelInvoice` also refund linked payments automatically, or just detach them? Recommendation: detach only; refunds are explicit actions.