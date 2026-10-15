# Spec: Aquri PMS — Dual NFC Tag System (Phase 5)

## Objective

The backend currently has **zero** NFC/RFID support. The frontend models a single
`RfidTag` (staff-badge-only) as a demo. This phase builds a real dual-purpose NFC
data layer: one `RfidTag` entity that covers **guest stay tags** and **staff badges**,
plus a tap flow that records attendance and resolves guest context.

The hardware path uses the browser **Web Serial API** behind a feature flag, with
**manual UID entry** as the always-available fallback. No real door-lock or access-
control enforcement ships in this phase — guest-tag taps are read-only lookups and
staff-badge taps write attendance only.

Success = a `RfidTag` can be issued, tapped (by reader or by hand), and looked up;
staff taps produce `AttendanceRecord`s; guest taps resolve guest/room context; all
existing tests stay green and new behavior is covered.

## Assumptions (correct these now if wrong)

1. **Model:** one `RfidTag` entity with a `Kind` discriminator
   (`Guest` | `Staff`), not two entities. This mirrors the frontend demo and keeps
   issuance/revocation logic in one place. (Interview hypothesis, high confidence.)
2. **Binding:** a `Guest` tag binds to a `Booking` (FK), not a bare `Guest` or
   `Room` — a booking already ties guest→room→finite stay and gives natural expiry.
   A `Staff` tag binds to a `User` (FK). Exactly one of the two FKs is set,
   enforced by the `Kind`.
3. **Tap semantics:** staff badge tap = attendance punch (in/out) only; guest tag
   tap = read-only context resolution (guest name, room, booking status). No door
   events, no access-control gates.
4. **Access levels:** kept as a free-form string (like the frontend demo) for now.
   No real permission-set modeling — out of scope.
5. **Expiry:** guest tags can carry an optional `ExpiresAt`; staff badges do not
   expire by default. `Status` drives revocation (`active`/`inactive`/`lost`/
   `blocked`).
6. **Roles:** issue/revoke restricted to `admin`/`manager`, matching existing
   property-level mutations.
7. **Migration:** scaffold an EF migration. Local apply stays blocked by the known
   28P01 Postgres env issue — the migration ships with the code; we just cannot
   apply it locally.

## Tech Stack

- .NET 8, Clean Architecture (Domain / Application / Infrastructure / API / Tests)
- MediatR (record commands + one handler per file), EF Core (Postgres), `Result<T>`
- Frontend: React 19, Vite, Zustand (contract in `src/store/useAppStore.ts`)

## Commands

```
Build:   $env:TEMP="C:\Temp"; $env:TMP="C:\Temp"; dotnet build Aquri.sln -nodeReuse:false
Test:    $env:TEMP="C:\Temp"; $env:TMP="C:\Temp"; dotnet test Aquri.sln -nodeReuse:false --no-build
Migrate: dotnet ef migrations add AddRfidTags --project Aquri.Infrastructure --startup-project Aquri.API
Front-end lint:  npx eslint <touched files>   (workdir C:\wamp64\www\employee2\app)
Front-end build: npm run build                (workdir C:\wamp64\www\employee2\app)
```

## Project Structure

```
Aquri.Domain/Entities/RfidTag.cs          — entity + wire-status + Kind enum
Aquri.Application/RfidTags/               — record commands, queries, DTO, handler
Aquri.Infrastructure/Persistence/Configurations/RfidTagConfiguration.cs
Aquri.Infrastructure/Persistence/Migrations/<next> — scaffolds AddRfidTags
Aquri.API/Controllers/RfidTagsController.cs
Aquri.Tests/RfidTags/                     — handler + tap-flow tests
app/src/store/useAppStore.ts              — replace RfidTag interface, add tap actions
app/src/lib/nfc/                          — WebSerialReader (flag-gated) + manual entry
```

## Code Style

Record command + separate handler, `Result<T>`, wire-status `TryParseWire`, no `.Result`:

```csharp
public record RecordStaffTapCommand(string TagNumber)
    : IRequest<Result<StaffTapResult>>;

public class RecordStaffTapHandler
    : IRequestHandler<RecordStaffTapCommand, Result<StaffTapResult>>
{
    private readonly IApplicationDbContext _context;
    public RecordStaffTapHandler(IApplicationDbContext context) => _context = context;
    public async Task<Result<StaffTapResult>> Handle(
        RecordStaffTapCommand request, CancellationToken ct)
    {
        var tag = await _context.RfidTags
            .FirstOrDefaultAsync(t => t.TagNumber == request.TagNumber, ct);
        if (tag is null) return Result<StaffTapResult>.NotFoundResult();
        // ... attendance punch ...
    }
}
```

Frontend local-first pattern (no `!` outside guards):

```ts
const recordStaffTap = async (tagNumber: string) => {
  // resolve locally first, then fire-and-forget syncToApi
};
```

## Testing Strategy

- xUnit + FluentAssertions + EF InMemory (existing `RoomHandlerTestBase` pattern).
- Cover: issue guest tag / staff badge; tap resolves correct kind; staff tap writes
  attendance (in then out); guest tap returns context, writes nothing; unknown /
  blocked / inactive tag rejects; expiry honored.
- Frontend: `npx eslint` + `npm run build` gate on touched files (ignore the known
  caniuse-lite / mockApi / chunk-size baseline warnings).

## Boundaries

- **Always:** keep 0 build warnings; keep suite green (423 baseline + new); follow
  one-command-per-file, `Result<T>`, wire-status helpers, Zustand local-first.
- **Ask first:** schema shape changes; adding NuGet/npm dependencies (Web Serial
  needs none); changing auth/RBAC model.
- **Never:** commit secrets; delete the vestigial `Aquri.Application/DTOs` dir (it
  is NOT vestigial — 25 live references); hard-code a device/reader dependency.

## Success Criteria

- [ ] `RfidTag` entity + `RfidTagKind` enum in Domain, EF config + scaffolds migration.
- [ ] Issue (guest/staff), revoke, and both tap commands implemented via MediatR.
- [ ] Staff tap creates/updates `AttendanceRecord`; guest tap resolves read-only context.
- [ ] Controller exposes issue/revoke/tap with `admin`/`manager` roles.
- [ ] Frontend `RfidTag` model updated; tap UI works via manual UID; Web Serial behind
      a flag (no-op / hidden when unsupported).
- [ ] `dotnet build` 0 warnings; `dotnet test` all green; frontend lint+build gate green.

## Open Questions (defaults chosen, flag if wrong)

1. Attendance punch detail: assume check-in then check-out toggle based on latest
   open `AttendanceRecord` for that user/day. Confirm.
2. Guest tap "context" shape: assume guest name + room number + booking status.
   Confirm.
3. Tag numbering: assume server-generated opaque UID (reader supplies raw UID; we
   store it as `TagNumber`). Confirm.
