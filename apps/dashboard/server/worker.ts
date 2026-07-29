import { PrivateBackend } from "@enschedule/pg-driver";
import { Worker } from "@enschedule/worker";
import { WorkerAPI } from "@enschedule/worker-api";

export type DashboardWorker = PrivateBackend | Worker | WorkerAPI;
let workerPromise: Promise<DashboardWorker> | undefined;

async function createWorker(): Promise<DashboardWorker> {
  if (process.env.ENSCHEDULE_WORKER_URL) {
    if (!process.env.ENSCHEDULE_API_KEY) {
      throw new Error("ENSCHEDULE_API_KEY is required with ENSCHEDULE_WORKER_URL");
    }
    return new WorkerAPI(process.env.ENSCHEDULE_API_KEY, process.env.ENSCHEDULE_WORKER_URL);
  }

  const accessTokenSecret = process.env.ENSCHEDULE_ACCESS_TOKEN_SECRET;
  const refreshTokenSecret = process.env.ENSCHEDULE_REFRESH_TOKEN_SECRET;
  if (!accessTokenSecret || !refreshTokenSecret) {
    throw new Error("ENSCHEDULE_ACCESS_TOKEN_SECRET and ENSCHEDULE_REFRESH_TOKEN_SECRET are required");
  }

  const worker = new Worker({
    name: "Dashboard integrated worker",
    workerId: "dashboard-integrated-worker",
    inlineWorker: true,
    apiKey: process.env.ENSCHEDULE_API_KEY,
    accessTokenSecret,
    refreshTokenSecret,
    nafsUri: process.env.NAFS_URI ?? "file:///tmp/enschedule-logs",
  });
  worker.logJobs = true;
  worker.retryStrategy = () => 5000;
  await worker.startPolling();
  return worker;
}

export function getWorker() {
  return (workerPromise ??= createWorker());
}
