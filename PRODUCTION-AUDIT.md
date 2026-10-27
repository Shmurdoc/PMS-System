# Production audit and payroll build

Date: 2026-10-27
Scope: backend, API, frontend, and the new payroll module. Every claim below was checked against the running system or the source at the line shown. Where I could not verify something, it says so.

## Bottom line

The system is not ready to move real money yet. Payroll is built properly, the property scoping work holds, and the invoice ledger now has one writer. Two money-path defects remain, plus payment creation still accepts duplicates. They are listed under P0 with the exact code to change.

What is safe today: running payroll end to end, the two-person approval rule, and settlement that cannot drift between an invoice and its payments.
What is not safe today: trusting that a failed save did not happen, trusting that two simultaneous bookings cannot double-book a room, and trusting that a double-clicked payment creates one row.

## Payroll: what was built

### Model

- `EmployeeCompensation` (Aquri.Domain/Entities/EmployeeCompensation.cs): salary or hourly, base amount, overtime multiplier, contracted hours, recurring allowances and deductions, effective date, active flag. Only one active package per person per property, enforced by a filtered unique index (`IX_EmployeeCompensations_OneActive`).
- `PayrollRun` (Aquri.Domain/Entities/PayrollRun.cs): property, period, status (`draft`, `approved`, `paid`, `cancelled`), totals, actor fields for created, approved, and paid.
- `Payslip` (Aquri.Domain/Entities/Payslip.cs): a frozen snapshot of the package used, hours, overtime, gross, PAYE, UIF, other deductions, and net.
- Tax logic is isolated in `Aquri.Domain/Payroll/PayrollTaxTables.cs` (2024/2025 brackets, primary rebate, UIF capped at R17,712 per month). A tax-year update is one file, not a hunt through handlers.

### Invariants, and where each one is enforced

| Invariant | Enforced by |
|---|---|
| One run per property per period, cancelled runs excluded | filtered unique index `IX_PayrollRuns_UniquePeriod` plus an overlap check in the create handler |
| Period end cannot precede start; period cannot exceed 62 days | `PayrollRun` constructor |
| Gross = base + overtime + allowances | `Payslip.Verify`, called on construction and on add |
| Total deductions = PAYE + UIF + other | `Payslip.Verify` |
| Net = gross minus deductions, and never negative | `Payslip.Verify` and the calculator |
| Overtime cannot exceed hours worked | `PayrollCalculator` and `Payslip` constructor |
| Hourly staff are paid clocked hours, capped at contracted hours | `PayrollCalculator` |
| Hourly staff with no clocked hours get no slip | create handler |
| One payslip per employee per run | `PayrollRun.AddPayslip` plus a unique index |
| Only drafts can be edited or rebuilt | `PayrollRun.IsEditable` and `ClearPayslips` |
| A run cannot be approved without payslips or with a non-positive net | `PayrollRun.Approve` |
| Approval requires a different person than the creator | `PayrollRun.Approve` |
| Paid is terminal; a paid run cannot be cancelled | `PayrollRun.Cancel` |
| Money is rounded once, half away from zero | `Money.Round`, used by every step |
| Property isolation | global EF query filter plus `PropertyScopeBehavior` |

### API

`Aquri.API/Controllers/PayrollController.cs`

- `GET /payroll/runs` and `GET /payroll/runs/{id}`: admin, manager.
- `POST /payroll/runs`: admin, manager. Builds or rebuilds a draft from active packages and attendance in the period.
- `POST /payroll/runs/{id}/approve`: admin only.
- `POST /payroll/runs/{id}/pay`: admin only.
- `POST /payroll/runs/{id}/cancel`: admin, manager, reason required.
- `GET /payroll/payslips`: admin and manager see anyone in scope; every other role is forced to their own id and to approved or paid runs only.
- `GET /payroll/compensations`: admin, manager.
- `PUT /payroll/compensations`: admin only.

### UI

`frontend/src/pages/Payroll.tsx` under Finance, gated by `viewPayroll`. Runs table, payslip drill-down with per-line PAYE and UIF, pay package editor, and action buttons that reflect what the server will actually allow. An admin looking at their own draft sees "Needs a second admin" instead of an Approve button that would return 409. A manager sees "Awaiting admin".

### Verified live

Two demo packages were seeded (manager R32,000 plus R2,500 allowance, front desk R18,500 plus R1,200). A manager created October 2026:

- 2 staff, gross R54,200.00, deductions R8,598.32, net R45,601.68.
- Front desk slip: gross R19,700.00, PAYE R2,109.75, UIF R177.12, net R17,413.13.
- Manager slip: gross R34,500.00, PAYE R6,134.33, UIF R177.12, net R28,188.55.

Checks against the running API:

- Front desk `GET /payroll/runs` returned 403.
- Manager approving their own run returned 403 at the route (admin only). An admin approving a run they created returned 409 with the two-person rule message.
- Admin approved and paid the run; both actor names and timestamps were recorded.
- Cancelling a paid run returned 409.
- Creating a second run for the same period returned 409.
- Front desk `GET /payroll/payslips` returned only their own slips.

Tests: 17 payroll invariant tests in `Aquri.Tests/Entities/PayrollTests.cs`. Full suite is 551 passing.

### Operational requirement

Approval needs an admin who did not create the run. A property with a single admin account cannot approve payroll that admin created. Either keep managers as the drafters, or give the property two admins. This is a deliberate control, not a bug.

## P0 findings

One fixed, three open.

### 1. Two writers for the invoice ledger (fixed)

What was wrong:
- `CompletePaymentHandler` marked the payment complete and stopped there, so the invoice never learned about the money.
- `RefundPaymentHandler` marked the payment refunded and never reversed the invoice.
- `POST /invoices/{id}/payments` wrote `paidAmount`, `status`, and `paidDate` with no payment row behind it.
- The UI then computed the ledger itself in `FinancialManagement.tsx` and posted twice, one call per table. Two calls, no transaction.

Result: invoice settlement could drift from the payments table, and a refund left the invoice looking settled.

What changed:
- `Invoice.ReversePayment(amount)` mirrors `RecordPayment`. It refuses to reverse more than was recorded, moves the invoice to `partial` while money is still held, and to `refunded` when nothing is. The paid date clears.
- `CompletePaymentHandler` loads the attached invoice and calls `RecordPayment` before the single `SaveChanges`, so the payment row and the invoice commit together or not at all.
- `RefundPaymentHandler` calls `ReversePayment` in the same way.
- Both handlers answer a replay with the current row instead of writing twice.
- `POST /invoices/{id}/payments` and its command are gone. The handler tests for it were replaced with settlement tests.
- The store no longer writes `paidAmount`. It refreshes the invoice from `GET /invoices/{id}` after each transition, so the screen shows what the server committed.

Evidence, against the running API:
- Paying the exact total (R275.00) moved the invoice to `paid` with a paid date.
- Completing the same payment again returned 200 and left `paid` at R275.00.
- Refunding it moved the invoice to `refunded`, `paidAmount` R0.00, paid date cleared.
- Refunding again returned 200 with no second reversal.
- Completing an overpay returned 409 with "Payment of 9999,00 would overpay the invoice. Outstanding amount is 13,75." The payment stayed `pending` and the invoice stayed `draft` at R0.00.
- Half the total produced `partial` at R137.50 of R275.00.
- `POST /invoices/{id}/payments` now returns 404.

Evidence, in the browser:
- R412.50 invoice, paid through the Record Payment modal. The row went from R0.00, balance R412.50, `draft` to R412.50, `Settled`, `paid` without a reload, and stayed that way after a reload.
- Refunding the payment from the Payments tab returned the invoice to `refunded`, R0.00 paid, also after a reload.
- No console errors and no failed API calls in either flow.

Tests: 4 domain tests for `ReversePayment`, 4 handler tests for completion (including an atomicity check that reads the store from a fresh context after a failed overpay), and 3 for refunds. Full suite is 551 passing.

Operational note: because the reversal is strict, a refund is refused when the invoice does not show the money. That is deliberate. Rows written before this change may have payments that the invoice never recorded, and those need reconciling before they can be refunded, rather than being silently clamped.

### 2. Optimistic writes never roll back

Evidence: `syncToApi` in `frontend/src/store/useAppStore.ts` catches the error, shows a toast that says the change stays on screen, and leaves the row. There is no retry queue and no reconciliation.

Result: a failed payment or booking still looks saved. On reload it disappears. For money that is worse than a hard failure.

Fix: either roll back the local row on failure, or keep an outbox with status and a retry. Rollback is the smaller change and the safer default.

### 3. Booking overlap is a check-then-insert race

Evidence: `CreateBookingCommand` (`Aquri.Application/Bookings/CreateBookingCommand.cs:45`) runs an `AnyAsync` overlap query, then inserts. Two requests can both pass the check.

Fix: add a Postgres exclusion constraint on `(RoomId, daterange(CheckIn, CheckOut))` or wrap the check and insert in a serializable transaction with a retry. The constraint is the stronger option and also protects against future code paths.

### 4. Payment creation is not idempotent

Evidence: `CreatePaymentCommand` takes whatever the client sends and inserts. A double-click or a retried request creates two payments.

Fix: accept a client request id, store it, and add a unique index. Return the existing payment on a repeat.

## P1 findings

1. Audit trail is client-written. Pages call `addAuditLog` locally; most API commands write no `AuditLog` row. Any API client bypasses the trail entirely. Payroll records the actors on the run itself, which covers sign-off, but there is no audit row for create, rebuild, or cancel.
2. Invoice status changes have no endpoint. Sending, cancelling, and the paid flag written by older code paths only change the store, so a sent invoice is back to draft after a reload. `deletePayment` is local only for the same reason: no DELETE route exists. The ledger itself is now server-owned, but the lifecycle around it is not.
3. The property switcher only drives the dashboard. Most pages resolve their property from `me.propertyId` or the first property, so an admin switching scope sees the dashboard change and the rest of the app stay put.
4. No pagination on any list endpoint. A real property with years of bookings will load everything into memory.
5. Currency is hard-coded to ZAR in payroll and payments. No FX, no multi-currency reporting. Tax is one jurisdiction.
6. Payroll does not yet cover: unpaid leave, loans and advances with a repayment schedule, post-payment reversals (only pre-payment cancel exists), bank payment file export, payslip PDF or email, and GL posting. None of these block internal payroll, but a finance department will ask for all of them.
7. Guest role exists in the permission table and has no routes. Either finish it or remove it.

## P2 findings

1. No API integration tests for payroll; the tests are domain level. The live checks above were manual.
2. No e2e coverage for the Payroll page.
3. No rate limiting on login or payment endpoints. Password hashing has a timing-decoy path, which is good, but brute force is unthrottled.
4. No backup, restore, or migration runbook in the repo.
5. No structured logging around money mutations.

## Contract and mapping check

- `ApiUser` already typed `propertyId`, and the API now returns it in login and `/auth/me`. That fixed the "No property" chip and gives the store a real scope for every role.
- Payroll DTOs in `frontend/src/lib/api/payrollTypes.ts` mirror the C# DTOs one for one. A field rename breaks the build instead of blanking a cell.
- Payroll requests carry `PropertyId`, so `PropertyScopeBehavior` rejects any attempt to run or read another property's payroll before the handler executes.
- Tenant property id and primary key remain separate. Payroll uses the tenant id everywhere, including the foreign keys to `Properties.PropertyId`.

## What I would do next, in order

1. Roll back optimistic writes on failure (P0-2).
2. Add the booking exclusion constraint plus a serializable retry (P0-3).
3. Add payment idempotency (P0-4).
4. Server-side audit rows for money and payroll actions (P1-1).
5. An invoice status endpoint, so sending and cancelling survive a reload (P1-2).
6. Pagination and the property switcher on every page (P1-3, P1-4).
7. Payroll phase two: leave, loans, reversals, bank file, payslip document.

Until items 1 and 2 are done, do not let this system near a live cash drawer, however good the payroll screens look.
