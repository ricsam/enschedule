import { Worker } from "@enschedule/worker";

export const inlineWorker = () => {
  const worker = new Worker({
    forkArgv: [__filename, "__enschedule_worker_launch__"],
  });
  worker.logJobs = true;
  worker.retryStrategy = () => 5000;
  return worker;
};

if (process.argv[2] === "__enschedule_worker_launch__") {
  (async () => {
    const worker = inlineWorker();
    const ranJob = await worker.listenForIncomingRuns();
    if (ranJob) {
      return undefined;
    }
  })()
    .then(() => {
      // ignore
    })
    .catch(console.error);
}
