import type { Params } from "@remix-run/react";
import type { PublicJobRun } from "@enschedule/types";
import type { DashboardWorker } from "~/types";
import { getAuthHeader } from "~/sessions";

export const getRunData = async (
  params: Params,
  worker: DashboardWorker,
  request: Request
): Promise<PublicJobRun> => {
  const authHeader = await getAuthHeader(request);
  const runId = Number(params.runId);
  if (isNaN(runId)) {
    throw new Error("Invalid runId provided");
  }

  const run = await worker.getRun(authHeader, runId);
  if (!run) {
    throw new Error("Run not found");
  }

  return run;
};
