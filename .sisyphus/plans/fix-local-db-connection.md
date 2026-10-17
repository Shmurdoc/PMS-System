# Fix: Local DB connection-string confusion (which DB backs the API?)

## TL;DR

The API **is** connected to a database — the **Docker container `aquri-db` (postgres:16-alpine) on 127.0.0.1:5433**. Not the native Windows PostgreSQL 18 on 5432. `appsettings.json` is empty **by design**; the real local string lives in the gitignored `appsettings.Development.json`, and its current value points at the wrong port with a stale password. Fix: correct `appsettings.Development.json` to point at the live container, align `docker-compose.yml`'s host port with reality (5433, not 5432), and restart the API to prove it. Optionally fix a real 204-response bug found in `ApiResponseMiddleware`.

## Problem (verified, not guessed)

User asked: "why `.env` and not `appsettings.json`? connection string isn't created yet. what database is actually running the project as backend if this database isn't connected?"

Findings from live investigation:

1. `Aquri.API/appsettings.json` has `"ConnectionStrings:DefaultConnection": ""` — **intentional**. Secrets are never committed. `Program.cs` fail-fasts on empty (`Missing configuration: ConnectionStrings:DefaultConnection...`). Same for `Jwt:Key` and `AI:ApiKey`.
2. The local values live in **gitignored** `Aquri.API/appsettings.Development.json` (confirmed via `git check-ignore`):
   - `Host=localhost;Database=Aquri;Username=aquri_user;Password=secret_Aquri2024!` (no Port → defaults to **5432**)
3. **That string is wrong on two counts:**
   - Native PostgreSQL 18 (Windows service `postgresql-x64-18`, port 5432) **rejects** it: `FATAL: password authentication failed for user "aquri_user"` via psql. It is an unrelated install (likely another project — there's also an `easyryde-backend` container running).
   - The live `aquri-db` container maps **host 127.0.0.1:5433 → container 5432** and its real password is the 24-char `POSTGRES_PASSWORD` from the root `.env` — **not** `secret_Aquri2024!`.
4. **The running API (PID 24132, started 2026-10-16 20:04:29 as `Aquri.API.exe --urls http://localhost:5080`, env=Development) IS connected to `aquri-db`:**
   - `/health` → 200 Healthy (NpgSql check passes).
   - `POST /api/v1/auth/login` with `admin@nexus.com`/`admin123` → 200 + JWT (seeded users exist).
   - `pg_stat_activity` inside `aquri-db` shows an idle `aquri_user` session from `172.17.0.1` (the Docker bridge = host) — that's the API's EF connection pool.
   - `aquri-db` has all 27 tables + `__EFMigrationsHistory` + 3 seeded Users.
5. **How is it connected if the file string is wrong?** The API process must have been launched with an environment-variable override (`ConnectionStrings__DefaultConnection`) from the shell that started it (dotnet parent PID 15344). Env vars beat appsettings in .NET config order. That's why it works *now* but will **break on next restart** from a clean shell — the landmine.
6. `docker-compose.yml` says host port `5432`, but the running container was created with `5433` (compose file was edited after `docker compose up` created the container — ports don't hot-update). Native PG18 already owns 5432, so `docker compose up` with the current file would fail to bind anyway.
7. Bonus bug found in logs: `ApiResponseMiddleware` writes a body for **204 No Content** responses (`/api/v1/inventoryItems` and a login-path request) → Kestrel throws `InvalidOperationException: Writing to the response body is invalid for responses with status code 204` (ApiResponseMiddleware.cs:77). The 204/304 passthrough branch (lines 58–64) re-writes `bodyBytes` — for 204 the body must be **zero bytes written**, not rewritten.

## What the user is really asking

- "Why `.env`?" → `.env` is only read by **docker compose** (password interpolation for the container). The host-run API never reads `.env`. Two different config channels: compose (containerized) vs appsettings.Development.json + env vars (host-run dev).
- "Which DB backs the project?" → the Docker `aquri-db` container on 5433, proven above.
- "Fix it" → make the file config match reality so the API survives a restart without shell-env magic.

## Decision (confirmed by user)

**Docker `aquri-db` (postgres:16-alpine) on host port 5433 is the local dev backend.** Native PG18 on 5432 stays untouched (other projects use it). This plan is Option A, locked in.

## Implementation plan

### Step 1 — Fix `Aquri.API/appsettings.Development.json`
Set the connection string to the live container, reading the real password from `.env` at edit time:
```
Host=localhost;Port=5433;Database=Aquri;Username=aquri_user;Password=<POSTGRES_PASSWORD from .env>
```
(Leave `Jwt:Key` as-is — it works.)

### Step 2 — Align `docker-compose.yml` host port
Change db port mapping `127.0.0.1:5432:5432` → `127.0.0.1:5433:5432` so compose matches the already-running container and doesn't fight native PG18 for 5432. No container recreate needed (mapping already is 5433).

### Step 3 — (Optional, small) Fix the 204 bug in `Aquri.API/Middleware/ApiResponseMiddleware.cs`
In the 204/304 branch, do **not** write `bodyBytes`; restore the original body stream and return without writing (RFC 9110: no body on 204/304). Guard: `if (statusCode is 204 or 304) { context.Response.Body = originalBody; return; }` before the 3xx write.

### Step 4 — Restart API cleanly (no shell env override) and verify
- Kill PID 24132; start with `dotnet run --project Aquri.API --urls http://localhost:5080` (or the exe) from a fresh shell with **no** `ConnectionStrings__` env var.
- Verify: `/health` 200; login 200 + token; `GET /api/v1/properties` with Bearer token → 200; a 204 endpoint (e.g. DELETE) → 204 with no log error.
- Confirm `pg_stat_activity` in `aquri-db` shows the new idle pool session.

### Step 5 — Docs touch-up
- `tree diagram.txt` §12 config-landmines entry: replace the "5114-vs-5080" note context with the resolved facts (Development.json → 5433, compose → 5433, native PG18 unrelated on 5432).
- Do **not** commit unless asked.

## Verification checklist
- [ ] API restarts from clean shell and connects (no env var needed)
- [ ] Login works end-to-end against seeded `aquri-db` data
- [ ] `/health` Healthy
- [ ] 204 endpoint returns 204 without middleware exception in `api.out.log`
- [ ] `docker compose config` resolves with 5433 and validates `.env` interpolation

## Out of scope / notes
- `.env` remains gitignored (verified) — fine; it's for compose only.
- Native PG18 left running untouched — other projects (EasyRyde) may use it.
- Uncommitted `frontend/package.json`, `package-lock.json`, `frontend/e2e/`, `playwright.config.ts`, `tree diagram.txt` exist — unrelated to this fix; don't touch.
- Do not commit any of this unless explicitly asked.

## Exact files to change
1. `C:\Users\madoc\source\repos\Aquri\Aquri.API\appsettings.Development.json` — connection string → Port 5433 + real `.env` password
2. `C:\Users\madoc\source\repos\Aquri\docker-compose.yml` — db ports `127.0.0.1:5433:5432`
3. `C:\Users\madoc\source\repos\Aquri\Aquri.API\Middleware\ApiResponseMiddleware.cs` — 204/304 no-write fix (optional)
4. `C:\Users\madoc\source\repos\Aquri\tree diagram.txt` — §12 landmine note update (optional)
