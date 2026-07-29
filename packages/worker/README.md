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
  job: ({ name }) => console.log(`Hello ${name}`),
});

await worker.startPolling();
worker.serve({ port: 8000 });
```

The API is served at `/api`; its health endpoint is `/api/healthz`.
