import { Worker } from "@enschedule/worker";
import { registerDemoFunctionsAndSchedules } from "./vercelDemo";

export const inlineWorker = async () => {
  const worker = new Worker({
    name: "Dashboard integrated worker",
    workerId: "dashboard-integrated-worker",
    forkArgv: [__filename, "launch"],
  });
  worker.logJobs = true;
  worker.retryStrategy = () => 5000;

  await worker.migrateDatabase();

  if (process.env.IMPORT_FUNCTIONS) {
    const imports = process.env.IMPORT_FUNCTIONS.split(",");
    for (const imp of imports) {
      await require(imp)(worker);
    }
  }
  if (process.env.VERCEL) {
    await registerDemoFunctionsAndSchedules(worker);
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
