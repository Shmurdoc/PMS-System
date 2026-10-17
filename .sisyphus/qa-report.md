# Aquri PMS — Full QA Audit Report

- Date: 2026-10-17
- Scope: Aquri repository (ASP.NET Core API + React/Vite frontend, PostgreSQL via Docker)
- Method: brute-force role-based E2E audit with Playwright (3 roles: admin / manager / front_desk), UI-driven seeding, API-side verification, API-side teardown
- Final result: **79 passed / 138 skipped / 0 failed** (217 tests, serial, 11.1 min) + `tsc -b` EXIT=0

---

## 1. Environment

| Component | Value |
|---|---|
| Database | PostgreSQL 16 (`aquri-db` container), host port 5433 → 5432, db `Aquri`, user `aquri_user` |
| API | http://localhost:5080 (`/api/v1`, health `/health`) |
| Frontend | Vite dev server http://localhost:5173 |
| Demo users | `admin@nexus.com`/`admin123`, `manager@nexus.com`/`manager123`, `front@nexus.com`/`front123` (`SEED_DEMO_USERS=true`) |
| Auth model | JWT in localStorage key `aquri_token`, sent as `Authorization: Bearer` (not cookies) |
| E2E suite | `frontend/e2e` — `npx playwright test` (workers: 1, fullyParallel: false, retries: 1, 60s timeout) |

## 2. Part A — Database / boot fixes

- Corrected API↔DB connectivity (connection string / compose port mapping 5433→5432); API boot clean, EF migration applied, connection pool visible.
- Fixed `ApiResponseMiddleware` crashing on no-content responses (HTTP 204/304 are now passed through unwrapped).
- Reseeded demo data; baseline verified via `docker exec aquri-db psql -U aquri_user -d Aquri`.

## 3. Test suite coverage (all specs green)

| Spec | Coverage |
|---|---|
| `00-smoke.spec.ts` | Per-role storage state + dashboard load |
| `01-nav-audit.spec.ts` | Nav visibility per role, every page loads, button inventory |
| `02-admin-crud.spec.ts` | Guests create/edit/delete, rooms create, bookings create + double-booking invariant + full lifecycle |
| `03-admin-crud-misc.spec.ts` | Inventory / expenses / tax configs / users / tickets CRUD (UI → API verified) + G1 gap pinned |
| `04-checkin-properties-rooms.spec.ts` | Properties create/edit/delete, rooms edit/delete, full check-in → check-out UI flow |
| `05-role-flows.spec.ts` | Manager/front_desk allowed vs forbidden endpoints + guest UI flows |
| `06-messaging.spec.ts` | Render, search, send DM (API-persisted), delete message, more-options actions; pins BUG-S6-1 |
| `07-facility.spec.ts` | Electricity + maintenance ticket CRUD; role access + RBAC (BUG-S7-1) |
| `07-staff-rfid-profiles.spec.ts` | Shift / RFID issue / employee add happy paths; RBAC (BUG-S7-2/3/4) |
| `08-finances.spec.ts` | Page access, expense + tax config CRUD, invoices/payments read-only surfaces, RBAC (BUG-S8-1) |
| `09-readonly-pages.spec.ts` | Analytics/Reports/Forecasting/Integrations/Settings/AI Enhancements render + interactions + role visibility |
| `10-invariants.spec.ts` | RBAC endpoint matrix (manager/front_desk), booking create validation, booking status machine, deposit guards, payment lifecycle |

Role coverage strategy: all non-setup specs run in every project and self-skip via `test.skip(testInfo.project.name !== role)` — this is why 138 tests are "skipped" (by design, not omissions).

## 4. Bugs found and fixed (all re-verified green)

| # | Bug | Fix |
|---|---|---|
| 1 | API response middleware broke 204/304 responses | Guarded in `ApiResponseMiddleware.cs` |
| 2 | Properties create: Int32 overflow on large numeric input | Guarded parse + validator ranges |
| 3 | Property `Description` dropped end-to-end | Added to command, validator, controller, frontend service mapping |
| 4 | `timestamptz` / `DateTime.Kind` mismatch broke date filtering | Normalized UTC handling |
| 5 | Property-detail edits did not persist | Fixed persistence path |
| 6 | API rejected string enum values in request bodies | JSON string-enum binding enabled (`Program.cs`) |
| 7 | Guests form allowed submit with empty ID Number/Nationality | `required` added in `Guests.tsx` |
| 8 | Test harness: `apiPatch` sent wrong content-type (415) | Fixed helper |
| 9 | BUG-S7-1: manager saw Electricity delete; API allows DELETE to admin only | UI delete gated to admin; spec asserts UI hidden + API 403 |
| 10 | BUG-S7-2: front_desk saw "Add Shift" (API 403) | Gated to admin/manager; false-success UI removed; spec updated |
| 11 | BUG-S7-4: front_desk saw "Create Tag" (API 403) | Gated to admin/manager; spec updated |
| 12 | BUG-S8-1: manager saw expense Delete (API 403) | Gated to admin; spec UI-seeds an expense and asserts no Delete + API 403 |

BUG-S7-3 (manager employee-profile manage actions) was already fixed via `PermissionGate`; header/comment corrected.

## 5. RBAC UI-gating sweep — applied across 11 pages

Every destructive/mutating affordance now mirrors the API's actual role rules:

| Page | Action | API rule | UI guard |
|---|---|---|---|
| FacilityManagement | Electricity Delete | admin | `isAdmin` |
| FinancialManagement | Expense Delete | admin | `isAdmin` |
| StaffScheduling | Add Shift, row Edit/Swap/Cancel/Delete | admin,manager | `canManage` |
| RfidManagement | Create Tag, row Edit, row Delete | admin,manager | `canManage` (Toggle left — local-only) |
| Guests | Delete (card, table, modal) | admin,manager | `canManage` |
| Rooms | Add Room, Edit, Quick Status | admin,manager | `canManage` |
| Rooms | Delete Room | admin | `isAdmin` |
| Messaging | Delete message | admin,manager | `canManage` |
| Integrations | Delete | admin | `isAdmin` |
| PropertyManagement | Add Room/Property, Edit, quick status | admin,manager | `canManage` |
| PropertyManagement | Delete (grid + detail) | admin | `isAdmin` |
| TicketManagement | Row Delete | admin,manager | `canManage` |
| BookingManagement | Booking Delete | admin,manager | `canManage` |

Deliberately left unguarded: Maintenance ticket actions in Facility (API allows maintenance/front_desk as well), RFID tap actions, Attendance actions (no UI uses them), booking "assign" (no UI exists).

## 6. Known limitations / documented gaps

| ID | Finding | Status |
|---|---|---|
| BUG-S6-1 | Messaging: front_desk sees hardcoded "Sarah Johnson" identity (conversations/search tied to a hardcoded name, not the session user) | Documented (pinned by spec) |
| G1 | `RateManagement.tsx` is mock-only — UI shows rate plans the API knows nothing about | Documented + pinned in `03-admin-crud-misc.spec.ts` |
| G2 | `NotificationBell.tsx` uses hardcoded mock notifications | Documented |
| G3 | `GlobalSearch.tsx` searches hardcoded mock data | Documented |
| G4 | "Coming Soon" placeholder pages exist in routing | Documented |
| G5 | Invoices tab is read-only — no UI to create invoices or record invoice payments despite API support | Documented |
| G6 | No UI surface for `POST /payments/{id}/complete` and `{id}/refund` | Documented |
| G7 | Nav issues: duplicate staff / rfid-management entries; `maintenance` route has no sidebar entry | Documented |
| — | `GET /auditlogs` is open to any authenticated role (front_desk got 200) but the frontend route-gates Audit Log | Documented (API/UI mismatch; UI is stricter) |

### Systemic notes

- `syncToApi` (store) swallows API errors (`.catch(console.warn)`) → optimistic UI can display success when the API call failed. All specs therefore verify mutations via API reads, not just UI state. Fixing the store layer was out of scope for this audit; flagged for follow-up.
- RFID tag edit/delete are local-only in the store (`updateRfidTag`/`deleteRfidTag` mutate state without server calls); the only server path is revoke. No `PUT /rfidtags` endpoint exists server-side.
- No `DELETE /payments` endpoint exists → test payment rows cannot be deleted; cleanup relies on lifecycle (refund) and leftover rows are accepted.
- Tax config rate is stored as a fraction (UI 12.5% → API 0.125) — intentional, pinned by spec.
- DB baseline after audit: Guests=10, Rooms=2, Properties=4, Bookings=0, Payments=1, Invoices=0 (matching pre-audit baseline; all audit-created rows torn down).

## 7. Verification evidence

- Full serial run: `cd frontend; npx playwright test --reporter=list` → **79 passed, 138 skipped, 0 failed** (217 tests, 11.1 min).
- RBAC regression re-run: `npx playwright test 07-facility 07-staff-rfid-profiles 08-finances` → 27 passed, 0 failed.
- Typecheck: `npx tsc -b` → EXIT=0.
- API login audit-log probe: front_desk login produces expected 403s on `/users`, `/workflows`, `/aiInsights` only.

## 8. How to re-run

```powershell
# Prereqs: API on :5080 and Vite on :5173 running; aquri-db container healthy
docker start aquri-db            # if needed
cd frontend
npx playwright test              # full suite
npx playwright test 08-finances  # a single spec
npx tsc -b                       # typecheck
```
