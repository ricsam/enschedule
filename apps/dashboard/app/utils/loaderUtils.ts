import type { Params } from "@remix-run/react";
import type { PublicJobRun } from "@enschedule/types";
import type { DashboardWorker } from "~/types";

export const getRunData = async (
  params: Params,
  worker: DashboardWorker
): Promise<PublicJobRun> => {
  const runId = Number(params.runId);
  if (isNaN(runId)) {
    throw new Error("Invalid runId provided");
  }

  const run = await worker.getRun(runId);
  if (!run) {
    throw new Error("Run not found");
  }

  return run;
};
