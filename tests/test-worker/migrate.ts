import "dotenv/config";
import { Worker } from "@enschedule/worker";

const worker = new Worker({
  name: "seed-worker",
  workerId: "seed-worker",
});
worker.logJobs = true;

export const migrate = async () => {
  await worker.migrateDatabase();
  await worker.register({
    username: "adm1n",
    name: "Admin",
    password: "s3cr3t",
    admin: true,
  });
};
