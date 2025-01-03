import "dotenv/config";
import { Worker } from "@enschedule/worker";

const apiKey = process.env.API_KEY;
const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
const nafsUri = process.env.NAFS_URI;

if (!accessTokenSecret || !refreshTokenSecret || !nafsUri) {
  throw new Error(
    "Missing required environment variables (ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET, NAFS_URI)"
  );
}
const worker = new Worker({
  name: "seed-worker",
  workerId: "seed-worker",
  apiKey,
  accessTokenSecret,
  refreshTokenSecret,
  nafsUri,
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
