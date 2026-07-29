---
sidebar_position: 1
---

# Getting started

Enschedule 2 runs on Bun and PostgreSQL. The dashboard is a Vite SPA backed by a same-origin Bun server, and worker/API calls use Richie RPC under `/api`.

## Local stack

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

Log in to view schedules, runs, functions, workers, and the admin area. API documentation is available at `/docs` and OpenAPI JSON at `/openapi.json`.

## Helm chart

```bash
helm upgrade --install enschedule infrastructure/charts/enschedule \
  --namespace enschedule --create-namespace
```

The chart deploys PostgreSQL, a worker, and the dashboard. Back up PostgreSQL and run the chart migration job before upgrading an existing deployment. PostgreSQL is the only supported database.
