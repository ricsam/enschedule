import type { PublicJobRun } from "@enschedule/types";
import type { LoaderFunction, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { Params } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import { RunRoute } from "~/components/routes/RunRoute";
import { getWorker } from "~/createWorker.server";
import type { Breadcrumb, DashboardWorker } from "~/types";
import { useRunBreadcrumbs } from "~/utils/breadcrumbUtils";
import { extendBreadcrumbs } from "~/utils/extendBreadcrumbs";
import { useBreadcrumbs as useParentBreadcrumbs } from "..";

const getLoaderData = async (params: Params, worker: DashboardWorker) => {
  const runId = Number(params.runId);
  if (Number.isNaN(runId)) {
    throw new Error("Invalid runId provided");
  }

  const run = await worker.getRun(runId);
  if (!run) {
    throw new Error("Run not found");
  }
  return run;
};

export type LoaderData = ReturnType<typeof getLoaderData>;

export const useBreadcrumbs = (
  data: SerializeFrom<LoaderData>
): Breadcrumb[] => {
  return extendBreadcrumbs(useParentBreadcrumbs(), useRunBreadcrumbs(data));
};

export const loader: LoaderFunction = async ({ params, context }) => {
  return json(await getLoaderData(params, await getWorker(context.worker)));
};

function useData() {
  return useLoaderData<PublicJobRun>();
}

export { action } from "~/components/routes/RunRoute";

export default function RunDetails() {
  const run = useData();

  return <RunRoute run={run} breadcrumbs={useBreadcrumbs(run)} />;
}
