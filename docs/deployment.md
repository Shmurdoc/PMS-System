# Deployment

## Topology

```
[ Postgres 16 (db) ] ← Host=db:5432 ← [ Aquri API (api) ] ← :8080 ← clients
```

Two containers via `docker-compose.yml`: `db` (postgres:16-alpine) and `api` (built from the root `Dockerfile`). The API waits for the DB healthcheck (`pg_isready`) before starting.

## Quick start

```bash
cp .env.example .env        # then edit — compose refuses to boot without real values
docker compose up -d --build
```

On first boot the API seeds the demo users (admin@nexus.com / manager@nexus.com / front@nexus.com — see `docs/getting-started.md`) unless `SEED_DEMO_USERS=false`. Migrations do not auto-apply; run them once per database (below).

## Environment variables

`.env` (compose reads it automatically):

| Variable | Required | Notes |
|---|---|---|
| `POSTGRES_PASSWORD` | yes | Postgres password for `aquri_user`; compose fails fast if unset |
| `JWT_KEY` | yes | Signing key, minimum 32 characters; compose fails fast if unset |
| `SEED_DEMO_USERS` | no (default `true`) | Seed demo logins on first boot; set `false` for real deployments |

Passed into the API container:

| Variable | Value |
|---|---|
| `ASPNETCORE_ENVIRONMENT` | `Production` |
| `ConnectionStrings__DefaultConnection` | `Host=db;Port=5432;Database=Aquri;Username=aquri_user;Password=${POSTGRES_PASSWORD}` |
| `Jwt__Key` | `${JWT_KEY}` |
| `Jwt__Issuer` / `Jwt__Audience` | `Aquri.API` / `Aquri.Client` |
| `Cors__AllowedOrigins__0..2` | `http://localhost:4200`, `http://localhost:5173`, `http://localhost:3000` |
| `AI__ApiKey` | optional — chat stays deterministic when unset |

The API fails fast on startup when `ConnectionStrings:DefaultConnection` or `Jwt:Key` is missing/empty. For non-compose hosts, set the same two values as environment variables (`ConnectionStrings__DefaultConnection`, `Jwt__Key`) or in `appsettings.Production.json` (not committed).

## Images

Two Dockerfiles exist:

- **Root `Dockerfile`** (used by compose): multi-stage build → publish → `aspnet:8.0` runtime, non-root `appuser` (uid 10001), listens on `http://+:8080`, healthcheck hits `GET /health` every 30s.
- **`Aquri.API/Dockerfile`**: Alpine SDK/runtime variant, exposes 80 and 8080, no non-root user or healthcheck — kept as a slimmer alternative, not wired into compose.

Build either manually with `docker build -t aquri-api .` (root Dockerfile) if not using compose.

## Database migrations

The API does not auto-migrate. Apply once per database:

```bash
dotnet ef database update --project Aquri.Infrastructure --startup-project Aquri.API
```

The design-time factory (`AquriDbContextFactory`) resolves `ConnectionStrings__DefaultConnection` first, so point the env var at the target database before running. Inside a running compose stack the DB is only reachable on the internal network; apply migrations from the host against the published port (`127.0.0.1:5432`).

## Ports

| Service | Host port | Container port |
|---|---|---|
| api | 8080 | 8080 |
| db | 127.0.0.1:5432 (loopback only) | 5432 |

Postgres is intentionally bound to loopback — it is not exposed beyond the host.

## Health and observability

- `GET /health` — liveness (no dependencies).
- `GET /health/ready` — readiness, includes a Postgres check; wire this to your load balancer / orchestrator probe.
- Swagger UI at `/swagger` (enabled outside Development as well — disable for hardened internet-facing deployments).

## CI

`.github/workflows/ci.yml` builds and tests the backend (`dotnet build` + `dotnet test`, dummy connection/JWT env) and lints + builds the frontend (`npm ci`, ESLint, `npm run build`). There is no CD pipeline — deployments are manual (`docker compose up -d --build` on the target host, or your platform of choice using the root Dockerfile).

## Production checklist

- [ ] `SEED_DEMO_USERS=false` — demo logins must not exist in production.
- [ ] Strong `POSTGRES_PASSWORD` and a random 32+ char `JWT_KEY`; rotate the JWT key by restarting the API (invalidates outstanding tokens).
- [ ] Restrict `Cors__AllowedOrigins__*` to the real frontend origin(s).
- [ ] Do not commit `.env`; keep `appsettings.Production.json` out of source control if it holds secrets.
- [ ] Run migrations once after each release that includes a new migration.
- [ ] Terminate TLS in front of the API (reverse proxy or platform); the container serves plain HTTP on 8080.
- [ ] Point readiness probes at `/health/ready`.
