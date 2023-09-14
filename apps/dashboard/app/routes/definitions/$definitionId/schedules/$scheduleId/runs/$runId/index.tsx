import type { LoaderFunction, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { differenceInMilliseconds } from "date-fns";
import { RootLayout } from "~/components/Layout";
import { RunRoute } from "~/components/routes/RunRoute";
import RunPage from "~/components/RunPage";
import type { Breadcrumb } from "~/types";
import { useRunBreadcrumbs } from "~/utils/breadcrumbUtils";
import { extendBreadcrumbs } from "~/utils/extendBreadcrumbs";
import { formatDate } from "~/utils/formatDate";
import { getRunData } from "~/utils/loaderUtils";

import { useBreadcrumbs as useParentBreadcrumbs } from "..";

export const useBreadcrumbs = (
  run: SerializeFrom<LoaderData>
): Breadcrumb[] => {
  return extendBreadcrumbs(
    useParentBreadcrumbs(run.jobSchedule),
    useRunBreadcrumbs(run)
  );
};

const getLoaderData = getRunData;

export const loader: LoaderFunction = async (args) => {
  const { params } = args;
  return json(await getLoaderData(params));
};

export type LoaderData = Awaited<ReturnType<typeof getLoaderData>>;

function useData() {
  const run = useLoaderData<LoaderData>();
  return run;
}

export { action } from "~/components/routes/RunRoute";

export default function Run() {
  const run = useData();

  return <RunRoute run={run} breadcrumbs={useBreadcrumbs(run)} />;
}
