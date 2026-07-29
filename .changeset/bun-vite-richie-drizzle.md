---
"@enschedule/cli": major
"@enschedule/dashboard": major
"@enschedule/hub": major
"@enschedule/pg-driver": major
"@enschedule/types": major
"@enschedule/worker": major
"@enschedule/worker-api": major
"@enschedule/worker-cli": major
---

Replace the Remix/Express/Sequelize/pnpm stack with Bun, a Vite React SPA using Richie Router, a Richie RPC API, and PostgreSQL/Drizzle. The old `/api/v1` contract and non-PostgreSQL dialects are removed. Function registration modules now use Bun-compatible ESM.
