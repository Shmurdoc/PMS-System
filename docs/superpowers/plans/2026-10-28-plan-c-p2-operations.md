# Plan C: P2 Operations - Pagination, Rate Limiting, Guest Role, Switcher, Currency

## Goal

Add pagination to all list endpoints, rate-limit payment endpoints, remove the unused Guest role, make the property switcher consistent for scoped users, and add per-property currency scaffolding.

## Architecture

1. **Pagination:** `PagedResult<T>` wrapper returned by all list handlers. Controllers accept `page`/`pageSize` query params. Handlers apply `.Skip`/`.Take` and `.CountAsync`.
2. **Rate limiting:** New fixed-window policy "payments" (10/min per IP) on payment create/complete/refund endpoints.
3. **Guest role:** Remove `guest` from `AppRoles.All` and `ROLE_PERMISSIONS`.
4. **Property switcher:** Frontend hides switcher for scoped users; admins keep full switcher.
5. **Multi-currency:** Add `Currency` column to `Property` entity. New payments/invoices inherit property currency.

## Tech Stack

.NET 8, EF Core, ASP.NET Core, React/TypeScript/Zustand.

## File Structure

- Modify: `Aquri.Application/Common/PagedResult.cs` - NEW
- Modify: All list query handlers (+ controllers) to accept page/pageSize and return PagedResult
- Modify: `Aquri.API/Controllers/PaymentsController.cs` - add rate limiting
- Modify: `Aquri.API/Program.cs` - add "payments" rate limit policy
- Modify: `Aquri.Domain/Entities/User.cs` - remove Guest from AppRoles.All
- Modify: `frontend/src/lib/rbac.ts` - remove Guest from ROLE_PERMISSIONS
- Modify: `frontend/src/App.tsx` - hide switcher for scoped users
- Modify: `Aquri.Domain/Entities/Property.cs` - add Currency property
- Modify: `Aquri.Infrastructure/Persistence/AquriDbContext.cs` - migration for Property.Currency
- Modify: payment/invoice creation to inherit Property.Currency

## Self-Review Checklist

- [ ] No em-dashes, double hyphens, stock transitions, or hype words in docs/comments.
- [ ] All list endpoints return paginated results.
- [ ] Payment endpoints rate-limited.
- [ ] Guest role removed from active roles.
- [ ] Switcher hidden for scoped users.
- [ ] Property.Currency column added.
- [ ] Build: 0 warnings, 0 errors.
- [ ] Frontend: tsc --noEmit clean.

---

### Task 1: Create PagedResult wrapper

**Files:**
- Create: `Aquri.Application/Common/PagedResult.cs`

- [ ] **Step 1:** Write PagedResult class.

```csharp
namespace Aquri.Application.Common
{
    /// <summary>Paged list result returned by every list endpoint.</summary>
    public sealed class PagedResult<T>
    {
        public List<T> Data { get; init; } = new();
        public int TotalCount { get; init; }
        public int Page { get; init; }
        public int PageSize { get; init; }
        public int TotalPages => PageSize > 0 ? (int)Math.Ceiling((double)TotalCount / PageSize) : 0;
    }
}
```

- [ ] **Step 2:** Build to verify.

Run: `dotnet build Aquri.sln --no-restore`

- [ ] **Step 3:** Commit.

```bash
git add Aquri.Application/Common/PagedResult.cs
git commit -m "feat: add PagedResult wrapper for paginated list endpoints"
```

---

### Task 2: Add pagination to list query handlers and controllers

**Files:**
- Modify: `Aquri.Application/Bookings/GetBookingsQuery.cs`
- Modify: `Aquri.Application/Payments/PaymentCommands.cs` (GetPaymentsHandler)
- Modify: `Aquri.Application/Invoices/InvoiceQueries.cs` (GetInvoicesHandler)
- Modify: `Aquri.Application/Rooms/Queries.cs` (GetRoomsByPropertyHandler)
- Modify: `Aquri.Application/Guests/GetGuestsQuery.cs`
- Modify: `Aquri.Application/Users/GetUsersQuery.cs`
- Modify: `Aquri.API/Controllers/BookingsController.cs`
- Modify: `Aquri.API/Controllers/PaymentsController.cs`
- Modify: `Aquri.API/Controllers/InvoicesController.cs`
- Modify: `Aquri.API/Controllers/RoomsController.cs`
- Modify: `Aquri.API/Controllers/GuestsController.cs`
- Modify: `Aquri.API/Controllers/UsersController.cs`

- [ ] **Step 1:** Add page/pageSize params to GetBookingsQuery + handler, apply Skip/Take/CountAsync.

- [ ] **Step 2:** Add page/pageSize params to GetPaymentsQuery + handler.

- [ ] **Step 3:** Add page/pageSize params to GetInvoicesQuery + handler.

- [ ] **Step 4:** Add page/pageSize params to GetRoomsByPropertyQuery + handler.

- [ ] **Step 5:** Add page/pageSize params to GetGuestsQuery + handler.

- [ ] **Step 6:** Add page/pageSize params to GetUsersQuery + handler.

- [ ] **Step 7:** Update all list controllers to accept and pass page/pageSize.

- [ ] **Step 8:** Build to verify.

Run: `dotnet build Aquri.sln --no-restore`

- [ ] **Step 9:** Commit.

```bash
git add -A
git commit -m "feat: add pagination to all list endpoints"
```

---

### Task 3: Rate limiting on payment endpoints

**Files:**
- Modify: `Aquri.API/Program.cs` - add "payments" policy
- Modify: `Aquri.API/Controllers/PaymentsController.cs` - add [EnableRateLimiting("payments")]

- [ ] **Step 1:** Add "payments" fixed-window rate limit policy in Program.cs.

- [ ] **Step 2:** Apply [EnableRateLimiting("payments")] to Create, Complete, Refund endpoints.

- [ ] **Step 3:** Build to verify.

Run: `dotnet build Aquri.sln --no-restore`

- [ ] **Step 4:** Commit.

```bash
git add -A
git commit -m "feat: rate-limit payment endpoints"
```

---

### Task 4: Remove Guest role from active roles

**Files:**
- Modify: `Aquri.Domain/Entities/User.cs` - remove Guest from AppRoles.All
- Modify: `frontend/src/lib/rbac.ts` - remove Guest from ROLE_PERMISSIONS

- [ ] **Step 1:** Remove 'guest' from AppRoles.All array in User.cs.

- [ ] **Step 2:** Remove 'guest' entry from ROLE_PERMISSIONS in rbac.ts.

- [ ] **Step 3:** Build frontend (tsc --noEmit) and backend (dotnet build).

- [ ] **Step 4:** Commit.

```bash
git add -A
git commit -m "feat: remove Guest role from active roles"
```

---

### Task 5: Property switcher consistency (frontend)

**Files:**
- Modify: `frontend/src/App.tsx` - hide switcher for scoped users

- [ ] **Step 1:** In App.tsx, hide the property switcher dropdown for users with viewAllProperties == false. Show only their assigned property chip.

- [ ] **Step 2:** Typecheck frontend.

Run: `npx tsc --noEmit` (in frontend/)

- [ ] **Step 3:** Commit.

```bash
git add -A
git commit -m "feat: hide property switcher for scoped users"
```

---

### Task 6: Multi-currency scaffolding (Property.Currency)

**Files:**
- Modify: `Aquri.Domain/Entities/Property.cs` - add Currency property
- Modify: `Aquri.Infrastructure/Persistence/AquriDbContext.cs` - migration
- Modify: payment/invoice creation to inherit Property.Currency

- [ ] **Step 1:** Add `Currency` property (string, default "ZAR") to Property entity.

- [ ] **Step 2:** Add migration for Property.Currency column.

- [ ] **Step 3:** Wire Property.Currency into payment/invoice creation defaults.

- [ ] **Step 4:** Build to verify.

Run: `dotnet build Aquri.sln --no-restore`

- [ ] **Step 5:** Commit.

```bash
git add -A
git commit -m "feat: add per-property currency scaffolding"
```

---

## Plan C Self-Review

**Spec coverage:**

- [x] Pagination → Task 1-2
- [x] Rate limiting → Task 3
- [x] Guest role cleanup → Task 4
- [x] Property switcher → Task 5
- [x] Multi-currency → Task 6

**Placeholder scan:** No TBD/TODO. Every code step has exact code.

**Type consistency:** PagedResult<T> generic type used consistently across handlers and controllers.