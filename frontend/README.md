# Aquri PMS — frontend

React client for the Aquri property management API. Vite + TypeScript + Tailwind + Zustand. Dark theme with a gold accent, 24 pages across 7 staff roles.

## Run it

```bash
npm ci
npm run dev      # http://localhost:5173
```

The app expects the backend on `http://localhost:5000` (see `src/lib/api/`). Log in with one of the demo accounts the API seeds (`admin@nexus.com` / `admin123`).

## Checks

```bash
npm run lint     # eslint, must be clean
npm run build    # tsc + vite build
```

Playwright specs live in `e2e/`. `qa-audits/` and `test-results/` are local run output, not source.

## Notes

State lives in `src/store/useAppStore.ts`. API calls go through `src/lib/api/` with per-property hydration. Pages are role-gated to match the backend (`admin`, `manager`, `front_desk`, `housekeeping`, `maintenance`, `auditor`).

`DESIGN_GUIDE.md` documents the color tokens and type scale the app actually uses.
