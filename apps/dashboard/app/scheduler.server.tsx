import { WorkerAPI } from "@enschedule/worker-api";

if (!process.env.WORKER_URL) {
  throw new Error("Environment variable WORKER_URL must be defined");
}
if (!process.env.API_KEY) {
  throw new Error("Environment variable API_KEY must be defined");
}

export const scheduler = new WorkerAPI(
  process.env.API_KEY,
  process.env.WORKER_URL
);
