import "dotenv/config";
import { Worker } from "@enschedule/worker";

const worker = new Worker({});
worker.logJobs = true;

export const migrate = async () => {
  await worker.migrate();
};
