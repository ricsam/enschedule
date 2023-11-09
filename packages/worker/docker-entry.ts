/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import fs from "node:fs";
import path from "node:path";
import { Worker } from "./api.js";

const worker = new Worker({});
worker.logJobs = true;

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
  if (fileExists) {
    console.log("Will load mounted job definitions", defaultRegisterJob);
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
