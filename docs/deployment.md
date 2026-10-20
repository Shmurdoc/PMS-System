# Deployment

## Topology

```
[ Postgres 16 (db) ] ← Host=db:5432 ← [ Aquri API (api) ] ← :8080 ← clients
```

Three services via `docker-compose.yml`: `db` (postgres:16-alpine), `api` (built from the root `Dockerfile`), and `web` (the frontend, built from `frontend/Dockerfile`). The API waits for the DB healthcheck (`pg_isready`) before starting.

## Quick start

```bash
cp .env.example .env        # then edit — compose refuses to boot without real values
docker compose up -d --build
```

On first boot the API seeds the demo users (admin@nexus.com / manager@nexus.com / front@nexus.com — see `docs/getting-started.md`) and the sample AI layer (agents, insights, workflows) unless `SEED_DEMO_USERS=false`. Migrations do not auto-apply; run them once per database (below).

## Environment variables

`.env` (compose reads it automatically):

| Variable | Required | Notes |
|---|---|---|
| `POSTGRES_PASSWORD` | yes | Postgres password for `aquri_user`; compose fails fast if unset |
| `JWT_KEY` | yes | Signing key, minimum 32 characters; compose fails fast if unset |
| `SEED_DEMO_USERS` | no (default `true`) | Seed demo logins and sample AI data on first boot; set `false` for real deployments |

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

## Frontend (`web` service)

`frontend/Dockerfile` builds the SPA (Node 20 → nginx) and `frontend/nginx.conf` serves it with a `location /api/` proxy to `http://api:8080`. The build takes `VITE_API_URL` as an arg:

- **empty string** (what compose passes) → the app calls `/api/v1/...` on its own origin. One hostname, no CORS, which is the whole point of the proxy.
- a URL → use it when the frontend is hosted somewhere other than the API (set it at build time, `VITE_API_URL=https://api.example.com npm run build`).
- unset → falls back to `http://localhost:5114` for local dev.

The `Cors__AllowedOrigins` note in the production checklist only matters for that second setup — the compose stack never crosses origins, so its defaults are fine as they are.

Two things the first full run caught, both fixed in the Dockerfiles: the aspnet runtime image has no `wget` (the API healthcheck installs `curl` instead), and Alpine's `wget` tries `::1` first while nginx only listens on IPv4 (the web healthcheck targets `127.0.0.1`). Also `.dockerignore` now excludes `.env` and `.gstack/` — `.env` was getting dragged into the API build context by `COPY . .`.

## Images

One Dockerfile exists:

- **Root `Dockerfile`** (used by compose): multi-stage build → publish → `aspnet:8.0` runtime, non-root `appuser` (uid 10001), listens on `http://+:8080`, healthcheck hits `GET /health` every 30s.

Build manually with `docker build -t aquri-api .` (root Dockerfile) if not using compose.

## Database migrations

The API does not auto-migrate. Apply once per database:

```bash
dotnet ef database update --project Aquri.Infrastructure --startup-project Aquri.API
```

The design-time factory (`AquriDbContextFactory`) resolves `ConnectionStrings__DefaultConnection` first, so point the env var at the target database before running. Inside a running compose stack the DB is only reachable on the internal network; apply migrations from the host against the published port (default `127.0.0.1:5433`).

## Ports

| Service | Host port | Container port |
|---|---|---|
| api | 8080 | 8080 |
| web | 8081 | 80 |
| db | 127.0.0.1:5433 (loopback only) | 5432 |

8080/8081 were both free on my machine — if either is taken on yours, change the left side of the mapping in `docker-compose.yml`; compose doesn't care which host port it gets. In theory `docker compose up` should also have pulled the images and started everything in one go; I'd expect the first build to sit a few minutes on the frontend npm step.

Postgres is intentionally bound to loopback — it is not exposed beyond the host.

The db host port is **5433**, not the Postgres default. `docker-compose.yml` publishes `${AQURI_DB_HOST_PORT:-5433}` because a native PostgreSQL service can own 5432 on the host; override `AQURI_DB_HOST_PORT` in `.env` if 5433 is taken too. Only the *host* mapping changes — container-to-container traffic still uses `db:5432`. (On the current dev machine 5433 happened to land inside a Windows `winnat` dynamic exclusion range, so `.env` sets `AQURI_DB_HOST_PORT=15433` — same idea, different number.)

For local development against that same container, `Aquri.API/appsettings.Development.json` (gitignored) needs the matching port:

```
Host=localhost;Port=5433;Database=Aquri;Username=aquri_user;Password=<the POSTGRES_PASSWORD from .env>
```

Omitting `Port=` silently defaults to 5432 and talks to whatever native Postgres is listening there instead of the container.

## Health and observability

- `GET /health` — liveness (no dependencies).
- `GET /health/ready` — readiness, includes a Postgres check; wire this to your load balancer / orchestrator probe.
- Swagger UI at `/swagger` (enabled outside Development as well — disable for hardened internet-facing deployments).

## CI

`.github/workflows/ci.yml` builds and tests the backend (`dotnet build` + `dotnet test`, dummy connection/JWT env) and lints + builds the frontend (`npm ci`, ESLint, `npm run build`). There is no CD pipeline — deployments are manual (`docker compose up -d --build` on the target host, or your platform of choice using the root Dockerfile).

## Production checklist

- [ ] `SEED_DEMO_USERS=false` — demo logins and sample AI data must not exist in production.
- [ ] Strong `POSTGRES_PASSWORD` and a random 32+ char `JWT_KEY`; rotate the JWT key by restarting the API (invalidates outstanding tokens).
- [ ] Restrict `Cors__AllowedOrigins__*` to the real frontend origin(s).
- [ ] Do not commit `.env`; keep `appsettings.Production.json` out of source control if it holds secrets.
- [ ] Run migrations once after each release that includes a new migration.
- [ ] Terminate TLS in front of the API (reverse proxy or platform); the container serves plain HTTP on 8080.
- [ ] Point readiness probes at `/health/ready`.
