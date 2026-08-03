# @enschedule/worker

Bun worker runtime and Richie RPC server for Enschedule.

```ts
import { Worker } from "@enschedule/worker";
import { z } from "zod";

const worker = new Worker({
  workerId: "worker-1",
  name: "Worker 1",
  accessTokenSecret: process.env.ENSCHEDULE_ACCESS_TOKEN_SECRET!,
  refreshTokenSecret: process.env.ENSCHEDULE_REFRESH_TOKEN_SECRET!,
  apiKey: process.env.ENSCHEDULE_API_KEY,
  nafsUri: process.env.NAFS_URI!,
});

worker.registerJob({
  id: "hello",
  version: 1,
  title: "Hello",
  dataSchema: z.object({ name: z.string() }),
  access: {
    view: { groups: ["developers"] },
    createSchedule: { groups: ["operators"] },
  },
  defaultScheduleAccess: {
    view: { groups: ["developers"] },
    edit: { groups: ["operators"] },
    run: { groups: ["operators"] },
    delete: { groups: ["operators"] },
  },
  defaultRunAccess: {
    view: { groups: ["developers"] },
    viewLogs: { groups: ["operators"] },
    delete: { groups: ["operators"] },
  },
  job: ({ name }) => console.log(`Hello ${name}`),
});

await worker.startPolling();
worker.serve({ port: 8000 });
```

The API is served at `/api`; its health endpoint is `/api/healthz`.

## Access control

Create groups and assign existing users in the dashboard's **Admin area → Groups** tab. Function declarations reference the group's immutable lowercase key, never a database ID. Unknown keys fail closed and appear under **Access diagnostics**.

Non-admin access is default-deny. For each action, an omitted grant inherits the nearest worker/function default, while a declared grant replaces it. `{ groups: [] }` explicitly denies the action. Administrators and the configured system API key bypass resource policies. Schedule access supports `view`, `edit`, `run`, and `delete`; run access supports `view`, `viewLogs`, and `delete`.
