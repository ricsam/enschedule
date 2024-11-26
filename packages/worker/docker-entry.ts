/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @typescript-eslint/no-var-requires */
/* eslint-disable @typescript-eslint/no-unsafe-call */
import fs from "node:fs";
import path from "node:path";
import type http from "node:http";
import { z } from "zod";
import { debug } from "debug";
import { Worker } from "./api.js";

const log = debug("worker");

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

let server: http.Server | undefined;
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
  const returns: Record<string, unknown> = {};
  if (fileExists) {
    console.log("Will load mounted job definitions", defaultRegisterJob);
    returns.default = await require(defaultRegisterJob)(worker);
  }

  if (process.env.IMPORT_HANDLERS) {
    const imports = process.env.IMPORT_HANDLERS.split(",");
    for (const imp of imports) {
      // eslint-disable-next-line no-await-in-loop
      returns[imp] = await require(imp)(worker);
    }
  }

  if (process.env.REGISTER_JOBS_SCRIPT) {
    await require(process.env.REGISTER_JOBS_SCRIPT)(worker, returns);
  }

  const ranJob = await worker.listenForIncomingRuns();
  if (ranJob) {
    return;
  }

  if (process.env.ENSCHEDULE_API) {
    server = worker
      .serve({
        port: process.env.API_PORT ? Number(process.env.API_PORT) : 8080,
        hostname: process.env.API_HOSTNAME,
      })
      .listen();
  }

  await worker.startPolling();
})();

function shutdown() {
  log("\nCleaning up resources...");
  if (server) {
    server.close(() => {
      log("HTTP server closed.");
      process.exit(0);
    });
  } else {
    process.exit(0);
  }
}

process.on("SIGINT", shutdown);
process.on("SIGTERM", shutdown);

process.on("exit", (code) => {
  log(`Process exiting with code ${code}`);
  log("Memory usage:", process.memoryUsage());
});
