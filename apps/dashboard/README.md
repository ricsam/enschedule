# Enschedule dashboard

The dashboard is a React 19 SPA built by Vite and routed by Richie Router. A Bun backend serves Richie RPC, secure cookie sessions, OpenAPI/docs, Vite assets, and SPA fallbacks.

```bash
bun run routes:generate
bun run typecheck
bun run build
NODE_ENV=production bun run start
```

For live development, start the backend on port 3000 and Vite in another terminal. Vite proxies API and documentation routes to the backend.

Required environment variables for an integrated worker are `DATABASE_URL`, `ENSCHEDULE_ACCESS_TOKEN_SECRET`, `ENSCHEDULE_REFRESH_TOKEN_SECRET`, and `NAFS_URI`. Set `ENSCHEDULE_COOKIE_SESSION_SECRET` to a strong value. For an external worker, also set `ENSCHEDULE_WORKER_URL` and `ENSCHEDULE_API_KEY`.
