import { WorkerAPI } from "@enschedule/worker-api";
import { standaloneWorker } from "./standaloneWorker";

const createScheduler = () => {
  if (process.env.WORKER_URL) {
    if (!process.env.API_KEY) {
      throw new Error("Environment variable API_KEY must be defined");
    }
    return new WorkerAPI(process.env.API_KEY, process.env.WORKER_URL);
  }

  return standaloneWorker();
};

export const scheduler = createScheduler();
