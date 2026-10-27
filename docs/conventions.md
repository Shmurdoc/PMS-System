# Conventions

These are the house rules. Follow them for new code. Existing code that violates them is being cleaned up as slices land — do not "fix" it opportunistically unless the task is that cleanup.

## Entities (Domain)

Private setters. Constructor validates required inputs and throws `ArgumentException`. Mutations go through domain methods that validate and update. No public setters on anything that carries a rule.

```csharp
public class Guest
{
    public int Id { get; private set; }
    public string Email { get; private set; } = string.Empty;

    public Guest() { } // EF Core

    public Guest(string email, string name)
    {
        if (string.IsNullOrWhiteSpace(email))
            throw new ArgumentException("Email cannot be null or empty.", nameof(email));
        Email = email.Trim();
        Name = name.Trim();
    }

    public void ChangeSegment(string segment)
    {
        var valid = new[] { "VIP", "Frequent", "New", "Corporate" };
        if (!valid.Contains(segment))
            throw new ArgumentException($"Segment must be one of: {string.Join(", ", valid)}.", nameof(segment));
        Segment = segment;
    }
}
```

String statuses are validated against a hardcoded list inside the method (`Room.ChangeStatus` is the reference). Money is `decimal(18,2)` in the EF mapping. Timestamps are `DateTime.UtcNow`, stamped inside the domain method or constructor.

## Business numbers

Ticket, invoice, and payment numbers (`TKT-2026-00042`, `INV-…`, `PAY-…`) are allocated through `INumberGenerator` (`Aquri.Application/Common/Interfaces`) — never `DateTime.Ticks` or ad-hoc counters. The generator owns one `NumberSequence` row per `{PREFIX}-{yyyy}` key, increments it on the request's scoped `DbContext` (so the bump commits or rolls back with the handler's `SaveChanges`), and seeds past the highest existing legacy number on first use. Format: `{PREFIX}-{yyyy}-{00001}` (5 digits). Duplicate reservations are rejected by the unique indexes on `TicketNumber`/`InvoiceNumber`/`PaymentNumber` and surface as an enveloped 409 (see the envelope section). Migration `AddNumberSequences` creates the table.

## Result pattern (Application)

Every command and query handler returns `Result<T>` (or `Result` for void operations). Never throw for expected business failures — return a failure. Exceptions are for bugs.

```csharp
public record CreateBookingCommand(int GuestId, int RoomId) : IRequest<Result<BookingDto>>;

// in the handler:
if (guest is null)
    return Result<BookingDto>.Failure($"Guest with ID {request.GuestId} not found.");

return Result<BookingDto>.SuccessResult(dto);
```

Factories: `Result.Ok()`, `Result.Failure(error)`, `Result.NotFoundResult()`, `Result<T>.SuccessResult(data)`, `Result<T>.Failure(error)`, `Result<T>.NotFoundResult()`. Controllers map `Success` to 2xx, `NotFound` to 404, otherwise 400.

## API response envelope

Every JSON response is wrapped in a uniform envelope, matching the frontend contract:

```json
{
  "success": true,
  "data": { },
  "error": null,
  "timestamp": "2026-10-13T21:35:40.2924451Z",
  "requestId": "2cd7677b26de4d29831e1ada4b4817b7"
}
```

Controllers keep returning bare DTOs/strings and mapping `Result` to status codes — `ApiResponseMiddleware` (`Aquri.API\Middleware`) buffers every response and wraps it:

- 2xx → `{ success: true, data: <parsed body> }`.
- 4xx/5xx → `{ success: false, error: { code, message, details? } }`. `details` is populated only in Development.
- 3xx redirects, `/health`, and `/swagger` pass through unwrapped.

Error codes (`ErrorCodes` in `Aquri.API/Common/ApiResponse.cs`): `VALIDATION` (400), `UNAUTHORIZED` (401), `FORBIDDEN` (403), `NOT_FOUND` (404), `CONFLICT` (409), `INTERNAL` (500). Unhandled exceptions become an enveloped 500 instead of a raw stack trace. `DbUpdateException` from a unique-constraint violation (duplicate e-mail, colliding business number) is caught by the middleware and returned as an enveloped 409 `CONFLICT`, not a generic 500.

Request correlation: the middleware echoes the inbound `X-Request-ID` header or generates a new one, included in every envelope. It is also stored on `HttpContext.Items["RequestId"]`.

## Controllers (API)

Thin. Receive the command/query, call `_mediator.Send`, map the `Result` to a status code. No business logic, no DbContext, no direct entity access.

```csharp
[ApiVersion("1.0")]
[ApiController]
[Route("api/v{version:apiVersion}/[controller]")]
[Authorize]
public class BookingsController : ControllerBase
{
    private readonly IMediator _mediator;

    public BookingsController(IMediator mediator) => _mediator = mediator;

    [HttpPost]
    [Authorize(Roles = "admin,manager,front_desk")]
    public async Task<ActionResult<BookingDto>> Create(CreateBookingCommand command)
    {
        var result = await _mediator.Send(command);
        if (result.Success)
            return CreatedAtAction(nameof(GetById), new { id = result.Data!.Id, version = 1 }, result.Data);
        return BadRequest(result.Error);
    }
}
```

Route template is always `api/v{version:apiVersion}/[controller]`. Every controller starts at `[ApiVersion("1.0")]`. Roles come from `AppRoles` constants (use the literal strings in the attribute; the constants are for Domain/Application logic).

## DI

Constructor injection only. No service locators, no statics except pure helpers like `AppRoles`. Handlers declare what they need; the container provides it.

```csharp
public class CreateBookingHandler : IRequestHandler<CreateBookingCommand, Result<BookingDto>>
{
    private readonly IApplicationDbContext _context;
    private readonly IMapper _mapper;

    public CreateBookingHandler(IApplicationDbContext context, IMapper mapper)
    {
        _context = context;
        _mapper = mapper;
    }
}
```

Register new services in `Program.cs` (API) with the appropriate lifetime. Handlers are picked up automatically by MediatR's assembly scan.

## Vertical slices (direction, Slices 4+)

New features get one folder per use case under the feature name:

```
Aquri.Application\
  Bookings\
    CreateBooking\
      CreateBookingCommand.cs      (record + handler together, or split if long)
      CreateBookingValidator.cs    (FluentValidation, Slice 6)
      BookingDto.cs                (feature-owned DTO)
    GetBooking\
      GetBookingQuery.cs
    UpdateBookingStatus\
      UpdateBookingStatusCommand.cs
```

`Rooms\` has been split by concern (Queries, RoomLifecycle*, UpdateRoom*). `DTOs\` still holds shared RoomDto/AuthDto — new DTOs go beside their feature; do not add to the flat pile.

Cross-cutting interfaces go in `Application\Common\Interfaces\` (or `Contracts\` once that is consolidated). Entity-specific interfaces stay next to their feature.

## File length

Keep files under ~200 lines. When a Handlers.cs grows past that, split it: one file per handler, or one file per command group. `Rooms\Handlers.cs` was the offender (416 lines) — it now lives as `RoomLifecycle*` + `UpdateRoom*` files.

## DTOs

DTOs live next to the feature that owns them, not in a shared dumping ground. Existing `Application\DTOs\RoomDto.cs` and `AuthDto.cs` stay put — both are referenced widely; new DTOs belong beside their feature. Mapping uses AutoMapper (`MappingProfile` in `Application\MappingProfiles\`). Mapster is referenced but not wired — do not introduce it until the team decides.

## Naming

- Commands: `CreateBookingCommand`, `UpdateRoomStatusCommand` (imperative verb + noun).
- Queries: `GetBookingQuery`, `GetRoomsByPropertyQuery`.
- Handlers: `CreateBookingHandler`, `UpdateRoomStatusHandler`.
- DTOs: `BookingDto`, `LoginResponseDto`.
- Status strings: lowercase snake for room-like statuses (`available`, `in_progress`), PascalCase for guest segment (`VIP`, `Corporate`) — match the frontend's union types exactly; see `useAppStore.ts`.

## Money, dates, currency

Currency is ZAR. VAT 15%, tourism levy 1% (from frontend `AppSettings`). Store amounts as `decimal(18,2)`. Stamp `CreatedAt`/`UpdatedAt` with `DateTime.UtcNow` in the handler or domain method, not in the controller.

## Git and review

`main` is protected. Every change lands through a pull request, including a one line doc fix. A direct push is rejected with `GH006: Changes must be made through a pull request`, so there is no "just this once" path.

### Branch names

- `feat/<topic>` for a new capability
- `fix/<topic>` for a defect
- `chore/<topic>`, `docs/<topic>`, `test/<topic>` for the obvious cases

Short topic, lowercase, hyphens: `feat/payroll`, `fix/invoice-ledger`.

### The cycle

```bash
git switch main
git pull --ff-only
git switch -c feat/invoice-ledger

# work, commit in small pieces

git push -u origin feat/invoice-ledger
gh pr create --base main --fill
```

Wait for both checks, read the diff on GitHub, then merge. Delete the branch when it lands:

```bash
gh pr merge <number> --merge --delete-branch
```

Merge with a merge commit, not a squash. The commits in a branch are written to be read, and squashing throws that away. Reserve squash for a branch that is one messy commit anyway.

### What blocks a merge

Branch protection on `main` requires:

- a pull request, no direct pushes, admins included
- `Backend build & test` and `Frontend build` from `.github/workflows/ci.yml` to pass
- the branch to be up to date with `main` first (strict mode)
- no force pushes, no branch deletion, no unresolved conversations

Required approvals is 0 because this is a solo repo. Raise it to 1 when a second maintainer joins.

### Run the gates locally first

CI runs the same commands you can run yourself, so a red PR is avoidable:

```bash
dotnet build Aquri.sln -nodeReuse:false
dotnet test Aquri.sln --no-build
cd frontend && npx eslint src && npm run build
```

`npm run build` does not run eslint. Two `react-hooks` errors reached a PR because only the build was checked locally, so run eslint as well.

### Commits

Conventional prefix, lowercase, specific: `fix(payroll): refuse a run the creator approved`. The body says what broke and why this change fixes it. One logical change per commit, and do not hide a refactor inside a behaviour change.

### Pull requests

The body answers three things: what changed, how it was verified, and what is knowingly left out. Verification means commands and figures, not "tested". A PR that touches money or tenancy names the invariant it protects and the test that proves it.

