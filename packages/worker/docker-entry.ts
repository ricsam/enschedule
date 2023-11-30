/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import fs from "node:fs";
import path from "node:path";
import { z } from "zod";
import { Worker } from "./api.js";

if (!process.env.WORKER_ID) {
  throw new Error("Missing WORKER_ID environment variable");
}
if (!process.env.WORKER_NAME) {
  throw new Error("Missing WORKER_NAME environment variable");
}

const worker = new Worker({
  workerId: process.env.WORKER_ID,
  name: process.env.WORKER_NAME,
  description: process.env.WORKER_DESCRIPTION,
});
worker.logJobs = true;
const pollInterval = z
  .number()
  .int()
  .positive()
  .safeParse(Number(process.env.POLL_INTERVAL));
worker.tickDuration = pollInterval.success ? pollInterval.data : 10000;

void (async () => {
  const defaultRegisterJob = path.join(
    "/app/packages/worker/definitions",
    "index.js"
  );
  let fileExists = false;
  try {
    fileExists = (await fs.promises.stat(defaultRegisterJob)).isFile();
  } catch (err) {
    // ignore
  }
  let returns: unknown;
  if (fileExists) {
    console.log("Will load mounted job definitions", defaultRegisterJob);
    returns = await require(defaultRegisterJob)(worker);
  }
  if (process.env.REGISTER_JOBS_SCRIPT) {
    await require(process.env.REGISTER_JOBS_SCRIPT)(worker, returns);
  }

  const ranJob = await worker.listenForIncomingRuns();
  if (ranJob) {
    return;
  }

  if (process.env.ENSCHEDULE_API) {
    worker
      .serve({
        port: process.env.API_PORT ? Number(process.env.API_PORT) : 8080,
        hostname: process.env.API_HOSTNAME,
      })
      .listen();
  }

  await worker.startPolling();
})();
