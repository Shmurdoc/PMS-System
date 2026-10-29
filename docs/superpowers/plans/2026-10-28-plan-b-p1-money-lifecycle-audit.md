# Plan B: P1 Money Lifecycle & Audit Trail

Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox syntax.

## Goal

Make invoice lifecycle transitions (send/cancel/detach-payment) server-enforced and persisted. Write a server-side AuditLog row for every money/staff mutation in the same transaction, so no API client can bypass the trail.

## Architecture

1. New commands/handlers: `SendInvoiceCommand`, `CancelInvoiceCommand`, `DetachPaymentCommand`. Use the domain `Invoice.ChangeStatus` transition table so invalid transitions are refused.
2. New controller endpoints on `InvoicesController`: `POST /invoices/{id}/send`, `POST /invoices/{id}/cancel`, `DELETE /invoices/{id}/payments/{paymentId}`.
3. `AuditTrail` static helper in `Aquri.Application/Common/`. It builds an `AuditLog` row from `ICurrentUser` and adds it to the DbContext. Called inside every money/staff handler before `SaveChangesAsync`.
4. `AuditLog` constructor gains an optional `propertyId` param.

## Tech Stack

.NET 8, EF Core, MediatR.

## File Structure

- Create: `Aquri.Application/Common/AuditTrail.cs`
- Modify: `Aquri.Domain/Entities/AuditLog.cs` - add optional propertyId to constructor
- Modify: `Aquri.Application/Invoices/` - new Send/Cancel/DetachPayment commands and handlers
- Modify: `Aquri.API/Controllers/InvoicesController.cs` - new send/cancel/detach-payment endpoints
- Modify: money/staff handlers - add `AuditTrail.Write` call before `SaveChangesAsync` (Create/Update/Delete User, Create/Complete/Refund Payment, Create/Send/Cancel Invoice, Create PayrollRun, Approve/Pay/Cancel PayrollRun, Create/Update/Delete Property)
- Test: new tests for send/cancel/detach-payment plus audit row existence

## Self-Review Checklist

- [ ] Spec coverage: invoice send/cancel/detach-payment → Tasks 1-4; audit trail → Tasks 5-8.
- [ ] Placeholder scan: no TBD/TODO; every code step has exact code.
- [ ] Type consistency: `AuditTrail.Write` signature matches all call sites. `AuditLog` constructor accepts optional propertyId.

---

### Task 1: AuditLog constructor - add optional propertyId

**Files:**

- Modify: `Aquri.Domain/Entities/AuditLog.cs`

- [ ] **Step 1:** Read AuditLog constructor to get exact signature.

Run: (no command - read file)

- [ ] **Step 2:** Add optional propertyId parameter to AuditLog constructor.

Add `int? propertyId = null` as the last constructor param and assign `PropertyId = propertyId`.

- [ ] **Step 3:** Build to verify.

Run: `dotnet build Aquri.sln --no-restore`
Expected: Build succeeded, 0 warnings, 0 errors.

- [ ] **Step 4:** Commit.

```bash
git add Aquri.Domain/Entities/AuditLog.cs
git commit -m "feat: AuditLog constructor accepts optional propertyId"
```

---

### Task 2: Create AuditTrail helper

**Files:**

- Create: `Aquri.Application/Common/AuditTrail.cs`

- [ ] **Step 1:** Write the AuditTrail class.

```csharp
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Infrastructure.Persistence;

namespace Aquri.Application.Common
{
    /// <summary>Writes an audit-log row for a money or staff mutation. Call inside the
    /// handler before <see cref="IApplicationDbContext.SaveChangesAsync"/> so the
    /// audit row commits in the same transaction as the change it describes.</summary>
    public static class AuditTrail
    {
        public static void Write(
            IApplicationDbContext context,
            ICurrentUser currentUser,
            string action,
            string entityType,
            string entityId,
            string entityName,
            string? oldValue = null,
            string? newValue = null)
        {
            var log = new AuditLog(
                currentUser.PropertyId,
                action,
                entityType,
                entityId,
                entityName,
                currentUser.UserId,
                currentUser.UserName,
                currentUser.UserRole,
                details: string.Empty);
            log.RecordChange(oldValue, newValue);
            context.AuditLogs.Add(log);
        }
    }
}
```

- [ ] **Step 2:** Build to verify.

Run: `dotnet build Aquri.sln --no-restore`
Expected: Build succeeded.

- [ ] **Step 3:** Commit.

```bash
git add Aquri.Application/Common/AuditTrail.cs
git commit -m "feat: add AuditTrail helper for server-side audit rows"
```

---

### Task 3: Invoice Send command+handler

**Files:**

- Create: `Aquri.Application/Invoices/SendInvoiceCommand.cs`

- [ ] **Step 1:** Write SendInvoiceCommand and handler.

```csharp
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Invoices
{
    /// <summary>Sends a draft or pending invoice (Draft to Sent or Pending to Sent).</summary>
    public record SendInvoiceCommand(int Id, string? SentBy) : IRequest<Result<InvoiceDto>>;

    public class SendInvoiceHandler : IRequestHandler<SendInvoiceCommand, Result<InvoiceDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public SendInvoiceHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<InvoiceDto>> Handle(SendInvoiceCommand request, CancellationToken cancellationToken)
        {
            var invoice = await _context.Invoices
                .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

            if (invoice is null)
                return Result<InvoiceDto>.NotFoundResult();

            if (!Invoice.CanTransitionTo(invoice.Status, InvoiceStatus.Sent))
                return Result<InvoiceDto>.ConflictResult(
                    $"Cannot send an invoice in status '{invoice.Status.ToWire()}'.");

            invoice.ChangeStatus(InvoiceStatus.Sent);
            AuditTrail.Write(_context, _currentUser, "send_invoice", "invoice", invoice.Id.ToString(), invoice.InvoiceNumber);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<InvoiceDto>.SuccessResult(InvoiceDto.FromEntity(invoice));
        }
    }
}
```

- [ ] **Step 2:** Build to verify.

Run: `dotnet build Aquri.sln --no-restore`
Expected: Build succeeded.

- [ ] **Step 3:** Commit.

```bash
git add Aquri.Application/Invoices/SendInvoiceCommand.cs
git commit -m "feat: add SendInvoice command and handler"
```

---

### Task 4: Invoice Cancel + DetachPayment commands and handlers

**Files:**

- Create: `Aquri.Application/Invoices/CancelInvoiceCommand.cs`
- Create: `Aquri.Application/Invoices/DetachPaymentCommand.cs`

- [ ] **Step 1a:** Add `DetachFromInvoice` to Payment entity.

**Files:** Modify `Aquri.Domain/Entities/Payment.cs`

```csharp
public void DetachFromInvoice()
{
    InvoiceId = null;
}
```

- [ ] **Step 1b:** Write CancelInvoiceCommand and handler.

```csharp
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using Aquri.Domain.Entities;
using Aquri.Domain.Enums;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Invoices
{
    /// <summary>Cancels an invoice and detaches linked payments (kept for audit).</summary>
    public record CancelInvoiceCommand(int Id, string? CancelledBy) : IRequest<Result<InvoiceDto>>;

    public class CancelInvoiceHandler : IRequestHandler<CancelInvoiceCommand, Result<InvoiceDto>>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public CancelInvoiceHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result<InvoiceDto>> Handle(CancelInvoiceCommand request, CancellationToken cancellationToken)
        {
            var invoice = await _context.Invoices
                .FirstOrDefaultAsync(i => i.Id == request.Id, cancellationToken);

            if (invoice is null)
                return Result<InvoiceDto>.NotFoundResult();

            if (!Invoice.CanTransitionTo(invoice.Status, InvoiceStatus.Cancelled))
                return Result<InvoiceDto>.ConflictResult(
                    $"Cannot cancel an invoice in status '{invoice.Status.ToWire()}'.");

            var payments = await _context.Payments
                .Where(p => p.InvoiceId == request.Id)
                .ToListAsync(cancellationToken);
            foreach (var payment in payments)
                payment.DetachFromInvoice();

            invoice.ChangeStatus(InvoiceStatus.Cancelled);
            AuditTrail.Write(_context, _currentUser, "cancel_invoice", "invoice", invoice.Id.ToString(), invoice.InvoiceNumber);
            await _context.SaveChangesAsync(cancellationToken);

            return Result<InvoiceDto>.SuccessResult(InvoiceDto.FromEntity(invoice));
        }
    }
}
```

- [ ] **Step 1c:** Write DetachPaymentCommand and handler.

```csharp
using Aquri.Application.Common;
using Aquri.Application.Common.Interfaces;
using MediatR;
using Microsoft.EntityFrameworkCore;

namespace Aquri.Application.Invoices
{
    /// <summary>Detaches a payment from an invoice (keeps the payment row for audit).</summary>
    public record DetachPaymentCommand(int InvoiceId, int PaymentId) : IRequest<Result>;

    public class DetachPaymentHandler : IRequestHandler<DetachPaymentCommand, Result>
    {
        private readonly IApplicationDbContext _context;
        private readonly ICurrentUser _currentUser;

        public DetachPaymentHandler(IApplicationDbContext context, ICurrentUser currentUser)
        {
            _context = context;
            _currentUser = currentUser;
        }

        public async Task<Result> Handle(DetachPaymentCommand request, CancellationToken cancellationToken)
        {
            var payment = await _context.Payments
                .FirstOrDefaultAsync(p => p.Id == request.PaymentId, cancellationToken);

            if (payment is null)
                return Result.NotFoundResult();
            if (payment.InvoiceId != request.InvoiceId)
                return Result.ConflictResult("That payment is not attached to the specified invoice.");

            payment.DetachFromInvoice();
            AuditTrail.Write(_context, _currentUser, "detach_payment", "payment", payment.Id.ToString(), payment.ProcessedBy);
            await _context.SaveChangesAsync(cancellationToken);
            return Result.Ok();
        }
    }
}
```

- [ ] **Step 2:** Build to verify.

Run: `dotnet build Aquri.sln --no-restore`
Expected: Build succeeded.

- [ ] **Step 3:** Commit.

```bash
git add Aquri.Domain/Entities/Payment.cs Aquri.Application/Invoices/CancelInvoiceCommand.cs Aquri.Application/Invoices/DetachPaymentCommand.cs
git commit -m "feat: add CancelInvoice and DetachPayment commands and handlers"
```

---

### Task 5: Wire new endpoints into InvoicesController

**Files:**

- Modify: `Aquri.API/Controllers/InvoicesController.cs`

- [ ] **Step 1:** Add Send endpoint.

After the `Get` endpoint, add:

```csharp
/// <summary>Sends a draft or pending invoice.</summary>
[HttpPost("{id:int}/send")]
[Authorize(Roles = "admin,manager,front_desk")]
[ProducesResponseType(typeof(InvoiceDto), StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
public async Task<ActionResult<InvoiceDto>> Send(int id, [FromBody] string? sentBy)
{
    var result = await _mediator.Send(new SendInvoiceCommand(id, sentBy));
    if (result.NotFound)
        return NotFound();
    if (result.Conflict)
        return Conflict(result.Error);
    if (!result.Success)
        return BadRequest(result.Error);
    return Ok(result.Data);
}
```

- [ ] **Step 2:** Add Cancel endpoint.

```csharp
/// <summary>Cancels an invoice and detaches its linked payments.</summary>
[HttpPost("{id:int}/cancel")]
[Authorize(Roles = "admin,manager")]
[ProducesResponseType(typeof(InvoiceDto), StatusCodes.Status200OK)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status400BadRequest)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
public async Task<ActionResult<InvoiceDto>> Cancel(int id, [FromBody] string? cancelledBy)
{
    var result = await _mediator.Send(new CancelInvoiceCommand(id, cancelledBy));
    if (result.NotFound)
        return NotFound();
    if (result.Conflict)
        return Conflict(result.Error);
    if (!result.Success)
        return BadRequest(result.Error);
    return Ok(result.Data);
}
```

- [ ] **Step 3:** Add DetachPayment endpoint.

```csharp
/// <summary>Detaches a payment from an invoice (kept for audit).</summary>
[HttpDelete("{id:int}/payments/{paymentId:int}")]
[Authorize(Roles = "admin,manager")]
[ProducesResponseType(StatusCodes.Status204NoContent)]
[ProducesResponseType(StatusCodes.Status404NotFound)]
[ProducesResponseType(typeof(ProblemDetails), StatusCodes.Status409Conflict)]
public async Task<IActionResult> DetachPayment(int id, int paymentId)
{
    var result = await _mediator.Send(new DetachPaymentCommand(id, paymentId));
    if (result.NotFound)
        return NotFound();
    if (result.Conflict)
        return Conflict(result.Error);
    if (!result.Success)
        return BadRequest(result.Error);
    return NoContent();
}
```

- [ ] **Step 4:** Build to verify.

Run: `dotnet build Aquri.sln --no-restore`
Expected: Build succeeded.

- [ ] **Step 5:** Commit.

```bash
git add Aquri.API/Controllers/InvoicesController.cs
git commit -m "feat: add invoice send/cancel and payment-detach endpoints"
```

---

### Task 6: Add audit rows to money and staff handlers

**Files:**

Modify each handler to call `AuditTrail.Write` before `SaveChangesAsync`.

- `Aquri.Application/Users/CreateUserCommand.cs` - audit create_user
- `Aquri.Application/Users/UpdateUserCommand.cs` - audit update_user
- `Aquri.Application/Users/DeleteUserCommand.cs` - audit delete_user
- `Aquri.Application/Payments/CreatePaymentCommand.cs` - audit create_payment
- `Aquri.Application/Payments/PaymentCommands.cs` - audit complete_payment / refund_payment
- `Aquri.Application/Invoices/CreateInvoiceCommand.cs` - audit create_invoice
- `Aquri.Application/Invoices/SendInvoiceCommand.cs` - audit send_invoice
- `Aquri.Application/Invoices/CancelInvoiceCommand.cs` - audit cancel_invoice
- `Aquri.Application/Invoices/DetachPaymentCommand.cs` - audit detach_payment
- `Aquri.Application/Payroll/CreatePayrollRunCommand.cs` - audit create_payroll_run
- `Aquri.Application/Payroll/...Approve/Pay/Cancel` - audit payroll transitions
- `Aquri.Application/Properties/CreatePropertyWithRoomsHandler.cs` - audit create_property
- `Aquri.Application/Properties/Commands/UpdatePropertyDetailsHandler.cs` - audit update_property
- `Aquri.Application/Properties/Status/UpdatePropertyStatusHandler.cs` - audit update_property_status
- `Aquri.Application/Properties/Commands/DeletePropertyCommand.cs` - audit delete_property

Each call site needs:

1. Add `ICurrentUser` to handler constructor (if not present).
2. Call `AuditTrail.Write(_context, _currentUser, "action", "entityType", id.ToString(), name, oldValue, newValue)` before `SaveChangesAsync`.

Do these in batches. Start with Users handlers.

- [ ] **Step 6a:** Audit in CreateUserHandler, UpdateUserHandler, DeleteUserHandler.
- [ ] **Step 6b:** Audit in payment handlers (Create, Complete, Refund).
- [ ] **Step 6c:** Audit in invoice handlers (Create, Send, Cancel, DetachPayment).
- [ ] **Step 6d:** Audit in payroll handlers (CreateRun, Approve, Pay, Cancel).
- [ ] **Step 6e:** Audit in property handlers (Create, UpdateDetails, UpdateStatus, Delete).
- [ ] **Step 6f:** Build to verify.

Run: `dotnet build Aquri.sln --no-restore`
Expected: Build succeeded.

- [ ] **Step 6g:** Commit.

```bash
git add -A
git commit -m "feat: write server-side AuditLog rows for all money and staff mutations"
```

---

### Task 7: Tests for send/cancel/detach-payment plus audit rows

**Files:**

- Create: `Aquri.Tests/Api/InvoicesApiTests.cs` (or add to existing)

- [ ] **Step 1:** Write test - Send moves Draft to Sent and writes AuditLog.
- [ ] **Step 2:** Write test - Cancel moves to Cancelled and detaches payments plus writes AuditLog.
- [ ] **Step 3:** Write test - DetachPayment removes invoice link from payment.
- [ ] **Step 4:** Write test - Invalid transition (e.g. Paid to Sent) returns 409.
- [ ] **Step 5:** Run full suite.

Run: `dotnet test Aquri.Tests/Aquri.Tests.csproj --no-restore`
Expected: all pass.

- [ ] **Step 6:** Commit.

```bash
git add -A
git commit -m "test: invoice send/cancel/detach-payment and audit-row tests"
```

---

## Plan B Self-Review

**Spec coverage:**

- [x] P1-2 invoice send/cancel/detach-payment → Tasks 1-6
- [x] P1-1 server-side audit trail → Task 2 + Task 6

**Placeholder scan:** No TBD/TODO.

**Type consistency:** `AuditTrail.Write(AquriDbContext, ICurrentUser, string, string, string, string, string?, string?)` - all call sites pass these args. `AuditLog` constructor accepts `int? propertyId`.