import type { LoaderFunction, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { Params } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import type { PublicJobRun } from "@enschedule/types";
import { differenceInMilliseconds } from "date-fns";
import { RootLayout } from "~/components/Layout";
import RunPage from "~/components/RunPage";
import { scheduler } from "~/scheduler.server";
import type { Breadcrumb } from "~/types";
import { useRunBreadcrumbs } from "~/utils/breadcrumbUtils";
import { extendBreadcrumbs } from "~/utils/extendBreadcrumbs";
import { formatDate } from "~/utils/formatDate";
import { useBreadcrumbs as useParentBreadcrumbs } from "..";
import { RunRoute } from "~/components/routes/RunRoute";

const getLoaderData = async (params: Params) => {
  const runId = Number(params.runId);
  if (isNaN(runId)) {
    throw new Error("Invalid runId provided");
  }

  const run = await scheduler.getRun(runId);
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

export const loader: LoaderFunction = async ({ params }) => {
  return json(await getLoaderData(params));
};

function useData() {
  return useLoaderData<PublicJobRun>();
}

export { action } from "~/components/routes/RunRoute";

export default function RunDetails() {
  const run = useData();

  return <RunRoute run={run} breadcrumbs={useBreadcrumbs(run)} />;
}
