# Combined plan: DB fix + full QA audit

## Part A — DB fix ✅ COMPLETE (verified this session)

1. ✅ `appsettings.Development.json` already had `Port=5433` + real password (applied in a prior session; file has PowerShell-style formatting).
2. ✅ `docker-compose.yml` already maps `127.0.0.1:5433:5432` (uncommitted).
3. ✅ `ApiResponseMiddleware.cs` 204/304 branch fixed: restore body stream, write NOTHING (split out from the 3xx branch). Verified: create+DELETE guest → `204`, empty body, no middleware exception in log.
4. ✅ API restarted clean (no `ConnectionStrings__` env override): /health 200, login 200, pool visible in `pg_stat_activity` on `aquri-db` from 172.17.0.1.
5. Note: NuGet lock was held by open Visual Studio — used `dotnet build --no-restore` to bypass; future builds may need the same while devenv is open.

## Part B — QA audit (Playwright, all 3 roles, segments) — NOT STARTED

**Harness first:**
- Add `"test:e2e": "playwright test"` to frontend/package.json (currently missing).
- Rewrite `seedBaseline` to seed via **UI forms** (property → rooms → guest through actual modals — user rule: seed only via frontend CRUD). Cleanup stays API-based (teardown ≠ seeding). Assertions via API reads stay (verification, not seeding).
  - ✅ Feasibility confirmed: the Add Property form persists via store `addProperty` → `syncToApi` → real `createProperty` API call (useAppStore.ts:1145–1161), so UI seeding truly hits the DB. Create property WITHOUT initial rooms (known tenant-id/EF-id divergence), then rooms via the separate "Add Room" modal (pattern proven by existing spec 02).
- Existing 4 specs: run, triage, fix any failures.
  - 🐛 Confirmed bug: `03-admin-crud-misc.spec.ts:137` navigates to `'Administration'` but the sidebar/page key is `'Admin'` (helpers.ts PAGE_TO_NAV.admin = 'Admin', NAV lists 'Admin') — will fail nav; fix to `'Admin'`.

**Segments (each = spec file, run + fix until green):**
- S1 smoke + nav audit × 3 roles (exists — run, capture button/input inventory to test-results/audit/).
- S2 admin core CRUD (exists — guests/rooms/bookings/overlap/lifecycle — re-run after seed change).
- S3 admin misc CRUD (exists — inventory/expenses/tax/users/tickets + Rates mock gap).
- S4 Check-In/Out + Properties CRUD + Rooms edit/delete (new).
- S5 manager + front_desk role flows: allowed CRUD + forbidden actions must 403 / hide (new).
- S6 Messaging/chats: send, receive, mark-read, delete, cross-role visibility (new).
- S7 Facility (maintenance + electricity), Staff Schedule + attendance, RFID manual path (no serial reader in CI), Employee profiles (new).
- S8 Finances deep: invoices (create/items/payment), payments (complete/refund), expense approve/reject (new).
- S9 Read-only pages: Analytics, Reports (+CSV export), Forecasting, Integrations, Settings, AI Enhancements (render, no crash, tabs work) (new).
- S10 Invariants sweep: RBAC 403s, double-booking, payment lifecycle, status machines — API-level with UI-driven seeds.
- S11 Gap analysis: diff nav-audit button inventory vs buttons exercised across specs; list untested controls, dead "Coming Soon" pages, missing features → fix what's fixable, document the rest.
- S12 Final full `playwright test` run (all projects, serial), write QA report to `.sisyphus/qa-report.md`.

## Rules
- Seed via UI only; verify via API; teardown via API.
- Brutal: every input, every button found in inventory; every CRUD path.
- No commits unless asked. Fix bugs found in src directly, re-verify.
