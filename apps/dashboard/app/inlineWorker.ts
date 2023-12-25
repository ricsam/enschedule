import { Worker } from "@enschedule/worker";
import path from "path";

export const inlineWorker = async () => {
  const worker = new Worker({
    name: "Dashboard integrated worker",
    workerId: "dashboard-integrated-worker",
    forkArgv: [__filename, "launch"],
  });
  worker.logJobs = true;
  worker.retryStrategy = () => 5000;
  const handlersEnv =
    process.env.DASHBOARD_INTEGRATED_WORKER_REGISTER_JOBS_SCRIPT;
  if (handlersEnv) {
    let handlerPath = handlersEnv;
    if (!handlersEnv.startsWith("/")) {
      handlerPath = path.join(process.cwd(), handlersEnv);
    }
    await require(handlerPath)(worker);
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
