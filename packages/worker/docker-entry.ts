/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import fs from "node:fs";
import path from "node:path";
import { Worker } from "./api.js";

if (!process.env.PGUSER) {
  throw new Error("The environment variable PGUSER must be defined");
}
if (!process.env.PGHOST) {
  throw new Error("The environment variable PGHOST must be defined");
}
if (!process.env.PGPASSWORD) {
  throw new Error("The environment variable PGPASSWORD must be defined");
}
if (!process.env.PGDATABASE) {
  throw new Error("The environment variable PGDATABASE must be defined");
}
if (!process.env.PGPORT) {
  throw new Error("The environment variable PGPORT must be defined");
}

const worker = new Worker({
  pgUser: process.env.PGUSER,
  pgHost: process.env.PGHOST,
  pgPassword: process.env.PGPASSWORD,
  pgDatabase: process.env.PGDATABASE,
  pgPort: process.env.PGPORT,
});
worker.logJobs = true;

void (async () => {
  const defaultRegisterJob = path.join("/app/packages/worker/definitions", "index.js");
  let fileExists = false;
  try {
    fileExists = (await fs.promises.stat(defaultRegisterJob)).isFile();
  } catch (err) {
    // ignore
  }
  if (fileExists) {
    console.log('Will load', defaultRegisterJob)
    await require(defaultRegisterJob)(worker);
  }
  if (process.env.REGISTER_JOBS_SCRIPT) {
    await require(process.env.REGISTER_JOBS_SCRIPT)();
  }
  await worker.startPolling();
  if (process.env.ENSCHEDULE_API) {
    worker.serve({
      port: process.env.API_PORT ? Number(process.env.API_PORT) : 8080,
      hostname: process.env.API_HOSTNAME,
    });
  }
})();
