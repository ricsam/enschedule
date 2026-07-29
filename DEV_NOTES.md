# Development notes

```bash
bun install --frozen-lockfile
bun x playwright install chromium

docker compose up -d
bun run --cwd tests/test-worker seed
bun run --cwd apps/dashboard build
bun run dev
```

Run checks:

```bash
bun run lint
bun run typecheck
bun run test
NODE_ENV=production bun run build
bun run playwright -- test
helm lint infrastructure/charts/enschedule
```

The active stack is Bun + PostgreSQL/Drizzle + Richie RPC + Vite/Richie Router. Do not add Node-only process launchers, pnpm scripts, Remix loaders/actions, Express routers, Sequelize models, SQLite fixtures, or Jest configuration to migrated paths.

The dashboard backend serves `/healthz`, `/api`, `/openapi.json`, `/docs`, static Vite assets, and manifest-validated SPA fallbacks. A direct load such as `/schedules/123` must return the SPA shell in production.
