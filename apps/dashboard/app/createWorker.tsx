import { WorkerAPI } from "@enschedule/worker-api";
import { inlineWorker } from "./inlineWorker";
import type { DashboardWorker } from "./types";

export const createWorker = () => {
  if (process.env.WORKER_URL) {
    if (!process.env.API_KEY) {
      throw new Error("Environment variable API_KEY must be defined");
    }
    return new WorkerAPI(process.env.API_KEY, process.env.WORKER_URL);
  }

  return inlineWorker();
};

let localWorkerInstance: DashboardWorker | undefined;

const initializeLocalWorkerWorker = (): DashboardWorker => {
  if (!localWorkerInstance) {
    localWorkerInstance = createWorker();
    return localWorkerInstance;
  }
  return localWorkerInstance;
};

export const getWorker = (contextWorker?: DashboardWorker): DashboardWorker => {
  const worker =
    contextWorker || localWorkerInstance || initializeLocalWorkerWorker();
  return worker;
};
