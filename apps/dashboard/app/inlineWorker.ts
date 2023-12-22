import { Worker } from "@enschedule/worker";

export const inlineWorker = async () => {
  const worker = new Worker({
    name: "Dashboard integrated worker",
    workerId: "dashboard-integrated-worker",
    forkArgv: [__filename, "launch"],
  });
  worker.logJobs = true;
  worker.retryStrategy = () => 5000;
  if (process.env.DASHBOARD_INTEGRATED_WORKER_REGISTER_JOBS_SCRIPT) {
    await require(process.env.DASHBOARD_INTEGRATED_WORKER_REGISTER_JOBS_SCRIPT)(worker);
  }
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
