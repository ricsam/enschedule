import "dotenv/config";
import { Worker } from "@enschedule/worker";

const worker = new Worker({
  name: "seed-worker",
  workerId: "seed-worker",
});
worker.logJobs = true;

export const migrate = async () => {
  await worker.migrateDatabase();
};
