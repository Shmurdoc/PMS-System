# Deploying Aquri

Single-host Docker Compose deployment: Postgres, the ASP.NET Core API, and the
React SPA (nginx, same-origin `/api` proxy — no CORS in this topology).

## Quick start

```bash
cp .env.example .env        # then edit every value
docker compose up -d --build
# SPA   → http://localhost:8081
# API   → http://localhost:8080  (health: /health)
```

First run with `SEED_DEMO_USERS=true` seeds three logins — admin@nexus.com,
manager@nexus.com, front@nexus.com — all with the demo password in the seed
code. **Create your own users and set `SEED_DEMO_USERS=false` before showing
this to anyone.**

## Environment (`.env`)

| Variable | Required | Notes |
|---|---|---|
| `POSTGRES_PASSWORD` | yes | Random and long. Only used inside the compose network; the Postgres port maps to loopback only. |
| `JWT_KEY` | yes | Minimum 32 characters. `openssl rand -base64 48` works. Rotating it invalidates every session. |
| `SEED_DEMO_USERS` | no (default `true`) | Set `false` once real users exist. |
| `AQURI_DB_HOST_PORT` | no (default `5433`) | Loopback port for Postgres; raise if taken. |

The API also reads `Cors:AllowedOrigins` (array) if you ever serve the SPA from
a different origin — the compose `web` service doesn't need it.

## Production notes

- **Reverse proxy / TLS**: put nginx or Caddy in front of `:8081` with a real
  certificate. The API enables `UseHttpsRedirection`; behind a proxy set
  `ASPNETCORE_FORWARDEDHEADERS_ENABLED=true` so scheme/host round-trip correctly.
- **Backups**: the database lives in the `aquri-data` volume. `docker compose
  exec db pg_dump -U aquri_user Aquri > backup.sql` on a schedule.
- **Updates**: `git pull && docker compose up -d --build`. Migrations run on
  API startup.
- **Reset**: `docker compose down -v` deletes the database volume entirely.

## Frontend builds outside compose

`VITE_API_URL` controls the API origin at build time. Unset →
`http://localhost:5114` (dev default). Set to the API's public origin for a
hosted frontend, or to `''` (empty) for same-origin behind a reverse proxy that
forwards `/api` to the API.

## What is intentionally not covered

Email/SMS providers, object storage, and a managed database — this compose file
is for demos and interviews on a single VM, not multi-node production.
