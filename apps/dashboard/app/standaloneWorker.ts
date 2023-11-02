import { Worker } from "@enschedule/worker";

export const standaloneWorker = () => {
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
    forkArgv: [__filename, "launch"],
  });
  worker.logJobs = true;
  worker.retryStrategy = () => 5000;
  return worker;
};

if (process.argv[2] === "launch") {
  (async () => {
    const worker = standaloneWorker();
    const ranJob = await worker.listenForIncomingRuns();
    if (ranJob) {
      return;
    }
  })();
}
