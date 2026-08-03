# Enschedule

Enschedule is a PostgreSQL-backed job scheduler with a Bun worker runtime and a Vite React single-page dashboard.

## Stack

- **Runtime and package manager:** Bun 1.3
- **Dashboard:** React 19, Vite, MUI, Richie Router, TanStack Query
- **API:** Richie RPC at `/api`; OpenAPI at `/openapi.json`; docs at `/docs`
- **Database:** PostgreSQL with Drizzle ORM and idempotent SQL migrations
- **Authentication:** same-origin signed HttpOnly session cookie with short-lived JWT access tokens and rotating refresh tokens

## Develop

```bash
bun install --frozen-lockfile
docker compose up -d

export DATABASE_URL=postgres://postgres:postgres@127.0.0.1:6543/postgres
export ENSCHEDULE_ACCESS_TOKEN_SECRET=change-me
export ENSCHEDULE_REFRESH_TOKEN_SECRET=change-me
export ENSCHEDULE_COOKIE_SESSION_SECRET=change-me
export NAFS_URI=file:///tmp/enschedule-logs
export ADMIN_ACCOUNT=adm1n:s3cr3t

bun packages/pg-driver/migrate.ts
bun run --cwd apps/dashboard build
NODE_ENV=production bun run --cwd apps/dashboard start
```

The production dashboard is available at `http://localhost:3000`. In development, run the Bun backend and Vite client separately:

```bash
bun run --cwd apps/dashboard start
bun x --cwd apps/dashboard vite
```

Vite proxies `/api`, `/healthz`, `/openapi.json`, and `/docs` to the Bun backend.

## Documentation

The Mintlify project lives in [`website`](website). Preview and validate it with:

```bash
bun run --cwd website dev
bun run --cwd website build
bun run --cwd website links
bun run --cwd website a11y
```

See [`website/README.md`](website/README.md) for API reference generation and Mintlify deployment setup.

## Worker

Function modules are ESM modules exporting a default registration function:

```js
import { z } from "zod";

export default async function register(worker) {
  worker.registerJob({
    id: "log-job",
    version: 1,
    title: "Log message",
    dataSchema: z.object({ message: z.string() }),
    job: ({ message }) => console.log(message),
  });
}
```

Run a worker and expose its typed API:

```bash
ENSCHEDULE_WORKER_ID=worker-1 \
ENSCHEDULE_WORKER_NAME='Worker 1' \
ENSCHEDULE_FUNCTIONS=./functions.js \
ENSCHEDULE_API=true \
ENSCHEDULE_API_PORT=8000 \
bun run --cwd packages/worker-cli start
```

The worker health route is `/api/healthz`.

## Role-based access control

Administrators define groups and assign existing users in the dashboard's **Admin area → Groups** tab. Worker and function code references immutable group keys in `access`, `defaultScheduleAccess`, and `defaultRunAccess`; unknown keys fail closed and are reported in the admin access diagnostics. See [`packages/worker/README.md`](packages/worker/README.md) for the declaration format and permission matrix.

## Database setup

Only PostgreSQL is supported. Initialize a clean database with:

```bash
DATABASE_URL=postgres://user:password@host:5432/database \
  bun packages/pg-driver/migrate.ts
```

The baseline creates the canonical greenfield schema and records it in `drizzle.__drizzle_migrations`.

## Verify

```bash
bun install --frozen-lockfile
bun run lint
bun run typecheck
bun run test
bun run build
bun run playwright -- test
helm lint infrastructure/charts/enschedule
```

## Containers

```bash
docker build --target dashboard -t enschedule-dashboard .
docker build --target worker -t enschedule-worker .
```

The Helm chart remains a two-image deployment and defaults its persistent volumes to the `rook-ceph-block` storage class.

## Breaking changes in 2.0

- Remix, Express serving, Sequelize, Umzug, SQLite, and the old `/api/v1` contract were removed from active runtime paths.
- The supported API base path is now `/api` and all first-party clients use Richie RPC.
- Bun and PostgreSQL are required.
- Function registration modules must be Bun-compatible ESM.

## License

MIT
