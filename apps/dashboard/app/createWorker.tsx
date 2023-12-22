import { WorkerAPI } from "@enschedule/worker-api";
import { inlineWorker } from "./inlineWorker";
import type { DashboardWorker } from "./types";

export const createWorker = async () => {
  if (process.env.WORKER_URL) {
    if (!process.env.API_KEY) {
      throw new Error("Environment variable API_KEY must be defined");
    }
    return new WorkerAPI(process.env.API_KEY, process.env.WORKER_URL);
  }

  return await inlineWorker();
};

let localWorkerInstance: DashboardWorker | undefined;

const initializeLocalWorkerWorker = async (): Promise<DashboardWorker> => {
  if (!localWorkerInstance) {
    localWorkerInstance = await createWorker();
    return localWorkerInstance;
  }
  return localWorkerInstance;
};

export const getWorker = async (contextWorker?: DashboardWorker): Promise<DashboardWorker> => {
  const worker =
    contextWorker || localWorkerInstance || initializeLocalWorkerWorker();
  return worker;
};
