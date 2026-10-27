# Production audit and payroll build

Date: 2026-10-27
Scope: backend, API, frontend, and the new payroll module. Every claim below was checked against the running system or the source at the line shown. Where I could not verify something, it says so.

## Bottom line

The system is not ready to move real money yet. Payroll is built properly now, and the property scoping work holds. Three defects still sit on the money path, and two of them can make the books disagree with the bank. They are listed under P0 with the exact code to change.

What is safe today: running payroll end to end, viewing the numbers, and the two-person approval rule.
What is not safe today: trusting that an invoice marked paid reflects the payments table, trusting that a failed save did not happen, and trusting that two simultaneous bookings cannot double-book a room.

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

Tests: 17 payroll invariant tests in `Aquri.Tests/Entities/PayrollTests.cs`. Full suite is 543 passing.

### Operational requirement

Approval needs an admin who did not create the run. A property with a single admin account cannot approve payroll that admin created. Either keep managers as the drafters, or give the property two admins. This is a deliberate control, not a bug.

## P0 findings, still open

### 1. Two writers for the invoice ledger

Evidence:
- `CreatePaymentCommand` attaches a payment to an invoice but never updates the invoice.
- `CompletePaymentHandler` (`Aquri.Application/Payments/PaymentCommands.cs:29`) marks the payment complete and stops there.
- `RefundPaymentHandler` (`PaymentCommands.cs:59`) marks the payment refunded and never reverses the invoice.
- The UI computes the invoice ledger itself in `FinancialManagement.tsx:493-524` and writes `paidAmount`, `status`, and `paidDate` locally, then creates a separate payment row.

Result: invoice paid amounts can drift from the payments table. A refund leaves the invoice looking settled. Reports built on invoices and reports built on payments will disagree.

Fix: make the payments table the only writer. On completion, load the invoice and call `invoice.RecordPayment(amount, method)`; on refund, add `Invoice.ReversePayment(amount)` and call it. Delete the client-side mutation of `paidAmount`. Add an idempotency guard so a replayed completion cannot double count. This needs tests before release.

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
2. Store actions with no server counterpart: `deletePayment` is local only, and `updatePayment` only syncs completion and refund. No UI path calls them today, so this is latent, but it is a trap.
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

1. Unify the invoice and payment ledger (P0-1) with tests.
2. Roll back optimistic writes on failure (P0-2).
3. Add the booking exclusion constraint plus a serializable retry (P0-3).
4. Add payment idempotency (P0-4).
5. Server-side audit rows for money and payroll actions (P1-1).
6. Pagination and the property switcher on every page (P1-3, P1-4).
7. Payroll phase two: leave, loans, reversals, bank file, payslip document.

Until items 1 to 3 are done, do not let this system near a live cash drawer, however good the payroll screens look.
