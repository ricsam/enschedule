import { Worker } from "@enschedule/worker";
import { registerDemoFunctionsAndSchedules } from "./vercelDemo";

export const inlineWorker = async () => {
  const apiKey = process.env.ENSCHEDULE_API_KEY;
  const accessTokenSecret = process.env.ENSCHEDULE_ACCESS_TOKEN_SECRET;
  const refreshTokenSecret = process.env.ENSCHEDULE_REFRESH_TOKEN_SECRET;
  const nafsUri = process.env.NAFS_URI;
  if (!accessTokenSecret || !refreshTokenSecret || !nafsUri) {
    throw new Error(
      "Missing required environment variables (ENSCHEDULE_ACCESS_TOKEN_SECRET, ENSCHEDULE_REFRESH_TOKEN_SECRET, NAFS_URI)"
    );
  }
  const worker = new Worker({
    name: "Dashboard integrated worker",
    workerId: "dashboard-integrated-worker",
    forkArgv: [__filename, "launch"],
    apiKey,
    accessTokenSecret,
    refreshTokenSecret,
    nafsUri,
  });
  worker.logJobs = true;
  worker.retryStrategy = () => 5000;

  await worker.migrateDatabase();

  if (process.env.ENSCHEDULE_FUNCTIONS) {
    console.log("Loading functions:", process.env.ENSCHEDULE_FUNCTIONS);
    const importFn = async (requirePath: string): Promise<void> => {
      const parts = requirePath.split(/,| +/);
      if (parts.length === 1) {
        try {
          await require(requirePath)(worker);
        } catch (err) {
          console.error("Error loading function", requirePath, err);
        }
      } else {
        await Promise.all(parts.map(importFn));
      }
    };

    if (process.env.ENSCHEDULE_FUNCTIONS) {
      await importFn(process.env.ENSCHEDULE_FUNCTIONS);
    }
  }
  if (
    process.env.VERCEL &&
    process.env.VERCEL_URL === "enschedule-dashboard.vercel.app"
  ) {
    await registerDemoFunctionsAndSchedules(worker);
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
