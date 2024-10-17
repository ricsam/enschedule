import { Worker } from "@enschedule/worker";

export const inlineWorker = async () => {
  const worker = new Worker({
    name: "Dashboard integrated worker",
    workerId: "dashboard-integrated-worker",
    forkArgv: [__filename, "launch"],
  });
  worker.logJobs = true;
  worker.retryStrategy = () => 5000;

  await worker.migrateDatabase();

  if (process.env.IMPORT_HANDLERS) {
    const imports = process.env.IMPORT_HANDLERS.split(",");
    for (const imp of imports) {
      await require(imp)(worker);
    }
  }
  await worker.startPolling();
  return worker;
};

if (process.argv[2] === "launch") {
  (async () => {
    const worker = await inlineWorker();
    const ranJob = await worker.listenForIncomingRuns();
    if (ranJob) {
      return;
    }
  })();
}
