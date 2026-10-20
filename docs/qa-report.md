# QA run notes — Aquri PMS

- Date: 2026-10-17
- What: role-based E2E pass over the ASP.NET Core API + React/Vite frontend (PostgreSQL in Docker)
- How: Playwright across three roles (admin / manager / front_desk), mutations checked against the API afterwards, audit rows torn down through the API
- Result: **79 passed / 138 skipped / 0 failed** (217 tests, serial, 11.1 min), plus `tsc -b` exit 0

The 138 skipped looks alarming if you glance at it cold — I did a double-take too. Every non-setup spec runs once per role project and skips itself when the role doesn't match, so the skips are the coverage strategy, not missing tests.

## Environment for this run

| Component | Value |
|---|---|
| Database | PostgreSQL 16 (`aquri-db` container), host 5433 → 5432, db `Aquri`, user `aquri_user` |
| API | http://localhost:5080 (`/api/v1`, health at `/health`) |
| Frontend | Vite dev server, http://localhost:5173 |
| Demo users | `admin@nexus.com`/`admin123`, `manager@nexus.com`/`manager123`, `front@nexus.com`/`front123` (seeding on for this run) |
| Auth | JWT in localStorage under `aquri_token`, sent as `Authorization: Bearer` — no cookies |
| Suite | `frontend/e2e` — `npx playwright test`, workers 1, fully parallel off, retries 1, 60s timeout |

## Setup fixes before anything would pass

- API couldn't reliably reach the DB — connection string and compose port mapping (5433 → 5432) were out of sync. Fixed both; boot is clean and the EF migration applies.
- `ApiResponseMiddleware` crashed on 204/304 responses. Guarded.
- Reseeded and eyeballed the baseline with `docker exec aquri-db psql -U aquri_user -d Aquri`.

## What was actually broken

Twelve things, all re-verified green after the fix:

| # | Bug | Fix |
|---|---|---|
| 1 | Response middleware broke 204/304 | Guarded in `ApiResponseMiddleware.cs` |
| 2 | Properties create: Int32 overflow on large numeric input | Parsed guard + validator ranges |
| 3 | Property `Description` dropped end-to-end | Added to command, validator, controller, frontend mapping |
| 4 | `timestamptz` / `DateTime.Kind` mismatch broke date filtering | Normalized to UTC |
| 5 | Property-detail edits didn't persist | Fixed the persistence path |
| 6 | API rejected string enum values in request bodies | Enabled JSON string-enum binding in `Program.cs` |
| 7 | Guests form submitted with empty ID Number / Nationality | `required` on both fields |
| 8 | Test helper `apiPatch` sent the wrong content-type (415) | Fixed the helper |
| 9 | BUG-S7-1: manager saw Electricity delete; API allows DELETE to admin only | UI gated to admin, spec asserts hidden + 403 |
| 10 | BUG-S7-2: front_desk saw "Add Shift" (API 403) | Gated to admin/manager, dead false-success UI removed |
| 11 | BUG-S7-4: front_desk saw "Create Tag" (API 403) | Gated to admin/manager |
| 12 | BUG-S8-1: manager saw expense Delete (API 403) | Gated to admin |

BUG-S7-3 (manager employee-profile actions) was already handled by `PermissionGate`; the stale header/comment around it got corrected.

## RBAC in the UI

Sweep across 11 pages so every destructive control mirrors what the API actually allows:

| Page | Action | API rule | UI guard |
|---|---|---|---|
| FacilityManagement | Electricity Delete | admin | `isAdmin` |
| FinancialManagement | Expense Delete | admin | `isAdmin` |
| StaffScheduling | Add Shift, row Edit/Swap/Cancel/Delete | admin,manager | `canManage` |
| RfidManagement | Create Tag, row Edit, row Delete | admin,manager | `canManage` (Toggle left alone — local-only) |
| Guests | Delete (card, table, modal) | admin,manager | `canManage` |
| Rooms | Add Room, Edit, Quick Status | admin,manager | `canManage` |
| Rooms | Delete Room | admin | `isAdmin` |
| Messaging | Delete message | admin,manager | `canManage` |
| Integrations | Delete | admin | `isAdmin` |
| PropertyManagement | Add Room/Property, Edit, quick status | admin,manager | `canManage` |
| PropertyManagement | Delete (grid + detail) | admin | `isAdmin` |
| TicketManagement | Row Delete | admin,manager | `canManage` |
| BookingManagement | Booking Delete | admin,manager | `canManage` |

Left alone on purpose: maintenance ticket actions in Facility (the API lets maintenance/front_desk in as well, so locking those to admin would have been wrong), RFID tap actions, attendance actions nothing calls, and booking "assign" for the same reason — no UI for it.

## Gaps I documented rather than fixed

| ID | Finding | Status |
|---|---|---|
| BUG-S6-1 | Messaging tied conversations to a hardcoded "Sarah Johnson" identity instead of the session user | Fixed since — see below |
| G1 | `RateManagement.tsx` is mock-only; the UI shows rate plans the API knows nothing about | Fixed — the page is store-backed now (create/copy/edit/toggle/delete all hit the API, audit-stamped), pinned as create → verify → delete in `03-admin-crud-misc.spec.ts` |
| G2 | `NotificationBell.tsx` used hardcoded mock notifications | Fixed — the bell now lists recent audit activity and new messages for whoever is signed in, with per-user read/dismiss state in localStorage (no `/notifications` endpoint exists, these two sources were already in the store) |
| G3 | `GlobalSearch.tsx` searched hardcoded mock data | Fixed since |
| G4 | "Coming Soon" placeholder pages still exist in routing | Fixed — the dead default branch was the last one; an unknown page key now lands on the dashboard |
| G5 | Invoices tab is read-only; no UI to create invoices or record payments even though the API supports both | Fixed — New Invoice modal computes subtotal/tax/total and creates through the API; completed invoices sync back |
| G6 | No UI for `POST /payments/{id}/complete` and `{id}/refund` | Fixed — Mark Complete / Refund buttons on payment rows, refund limited to admin/manager |
| G7 | Nav issues: duplicate staff / rfid-management entries, `maintenance` route has no sidebar entry | Fixed — the duplicate "RFID System" entry is gone (Staff & RFID already renders that page) and the dead `maintenance` route key is removed |
| BUG-S6-2 | `GET /messages` returned every message to any authenticated role | Fixed — message list, read-by-id, and mark-read are now participant-scoped server-side (sender, recipient, or a channel named after the reader's user id); non-participants get 404 on by-id so ids can't be probed |
| — | `GET /auditlogs` returns 200 for any authenticated role while the frontend route-gates the page | Fixed — both audit-log GETs require admin/manager; the frontend only fetches the trail for those roles |

## Since this audit

The fake-data layer on the frontend has been stripped out, which changes a few of the above:

- Messaging uses the signed-in user for conversations and search. The Sarah Johnson thing is gone.
- The notification bell's mock list is deleted. It's fed from what the app already tracks instead: recent audit entries plus messages addressed to the signed-in user, with read/dismiss state kept per user in localStorage. There's still no `/notifications` endpoint in the API (it 404s), so a brand-new account sees an empty bell until something happens.
- Global search indexes actual bookings, guests, rooms, and staff from the store (reports/settings are static links now).
- The AI Enhancements page no longer ships a canned fallback agent list — agents come from the API, and an empty property just shows an empty state. The fabricated confidence bars and scripted agent logs are gone too. Chat replies now only quote numbers that exist in the store; the offline fallback stays local and doesn't claim to have "analysed" anything.
- Pages stamp the signed-in user (id/name/role) on audit entries instead of hardcoded identities. Kiosk check-in still stamps itself as the kiosk — that one's deliberate.
- Account switching is honoured: notifications, messages, and audit stamps follow whoever is signed in. Demo controls and the demo-login panel on the login screen are removed.
- The messaging spec was rewritten against how the app actually behaves now: conversations come from the signed-in user, sends and deletes round-trip through the API, and front_desk is asserted read-only.
- Demo seeding is off by default now (`Seed:DemoUsers` for `dotnet run`; compose still defaults on, overridable with `SEED_DEMO_USERS` in `.env`). Fresh database + flag off means zero users — flip the flag for a first run, create real users, turn it off. `GET /users` also opened up to any signed-in role (the admin page stays gated in the UI).
- Authz tightened for hosting: message reads are participant-scoped in the query handlers (not just filtered in the UI), audit-log reads require admin/manager, and hydrate skips the audit fetch for other roles so they don't collect a guaranteed 403. New API tests pin each of these.
- Compose now has a `web` service: the SPA is built with an empty `VITE_API_URL` (same-origin) and nginx proxies `/api` to the API, so the containerized app needs no CORS at all. The runbook is `docs/deployment.md` — I'd drafted a separate DEPLOY.md before noticing the one already in `docs/`, so it got folded in there (with a wrong "migrations run on startup" line dropped; they don't). `.env.example` still lists the env keys. Ran the whole stack for real after that: db, api, and web all came up healthy, and login plus a guests fetch through the web proxy both returned 200. The first run also broke two healthchecks, which is how those got fixed.

One caveat, because I'd rather say it than let it look tidier than it is: apart from the messaging spec, I haven't re-run Playwright since any of these changes — the browser tooling was broken on this box. The green numbers above are the state as of Oct 17; everything since is code changes backed by typecheck, lint, and the backend test suite, plus a fresh green run of `06-messaging` (7 passed) once the helpers learned to point at a non-5080 API via `AQURI_API_URL`.

## Systemic notes

- `syncToApi` in the store now reports failures: a sync that dies without a custom handler shows a "Sync failed" toast (audit writes pass a silent handler — the API rejects those for non-admin/manager roles and the local log still keeps them). The specs read back through the API anyway, which remains the stronger check.
- RFID tag edit/delete are local-only in the store; the only server path is revoke (there is no `PUT /rfidtags`).
- No `DELETE /payments` endpoint, so test payment rows can't be cleaned up directly — lifecycle/refund only, leftover rows accepted.
- Demo seeding now includes one baseline property ("Nexus Grand Hotel"). Every message carries a PropertyId foreign key, so an empty Properties table made all sends fail with a 409 — which is exactly what a fresh database produced, since the old four properties were UI rows that never came back after a reset.
- Tax config rates are stored as fractions (UI 12.5% → API 0.125). Intentional, pinned by spec.
- DB baseline after the audit: Guests=10, Rooms=2, Properties=4, Bookings=0, Payments=1, Invoices=0 — matching the pre-audit baseline.

## Evidence and re-running

- Full serial run: `cd frontend; npx playwright test --reporter=list` → 79 passed, 138 skipped, 0 failed (11.1 min).
- RBAC re-run: `npx playwright test 07-facility 07-staff-rfid-profiles 08-finances` → 27 passed, 0 failed.
- Typecheck: `npx tsc -b` → exit 0.
- Login probe (re-checked today): front_desk token gets 403 on `/workflows` and `/aiinsights` (both admin/manager controllers); `/users` returns 200 since the List was opened up — see the seeding note above, the page itself is still gated in the UI.

```powershell
# needs API + Vite running and the aquri-db container healthy
# note: on this machine the DB port moved 5433 → 15433 (Windows started
# reserving 5433-5532 in a dynamic winnat range; no admin to clear it).
# .env has AQURI_DB_HOST_PORT=15433 now, and the dev config's connection
# string points at the same port.
docker compose up -d db          # brings up aquri-db on 15433
cd frontend
npx playwright test              # full suite
npx playwright test 08-finances  # single spec
npx tsc -b                       # typecheck
```
