import { Worker } from "@enschedule/worker";

export const inlineWorker = () => {
  const worker = new Worker({
    forkArgv: [__filename, "launch"],
  });
  worker.logJobs = true;
  worker.retryStrategy = () => 5000;
  return worker;
};

if (process.argv[2] === "launch") {
  (async () => {
    const worker = inlineWorker();
    const ranJob = await worker.listenForIncomingRuns();
    if (ranJob) {
      return;
    }
  })();
}
