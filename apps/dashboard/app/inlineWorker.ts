import { Worker } from "@enschedule/worker";
import path from "path";
import fs from "fs";
import zodModule from "zod";

export const inlineWorker = async () => {
  const worker = new Worker({
    name: "Dashboard integrated worker",
    workerId: "dashboard-integrated-worker",
    forkArgv: [__filename, "launch"],
  });
  worker.logJobs = true;
  worker.retryStrategy = () => 5000;
  const handlersEnv =
    process.env.DASHBOARD_INTEGRATED_WORKER_REGISTER_JOBS_SCRIPT;
  if (handlersEnv) {
    const filePath = path.join("/tmp", "__enschedule_handlers.js");

    try {
      await fs.promises.access(filePath, fs.constants.F_OK);
    } catch (error) {
      await fs.promises.writeFile(filePath, handlersEnv);
    } finally {
      // Override require to point to the z variable
      var Module = require("module");
      const originalRequire = Module.prototype.require;
      Module.prototype.require = (moduleName: string) => {
        if (moduleName === "zod") {
          return zodModule;
        }
        return originalRequire(moduleName);
      };
      await require(filePath)(worker);
      // Restore the original require function
      module.require = originalRequire;
    }
  }
  if (process.env.IMPORT_HANDLERS) {
    const imports = process.env.IMPORT_HANDLERS.split(",");
    for (const imp of imports) {
      await require(imp)(worker);
    }
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
