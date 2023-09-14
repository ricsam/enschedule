import {
  ActionFunction,
  json,
  LoaderFunction,
  redirect,
  SerializeFrom,
} from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { RunRoute } from "~/components/routes/RunRoute";
import { scheduler } from "~/scheduler.server";
import type { Breadcrumb } from "~/types";
import { useRunBreadcrumbs } from "~/utils/breadcrumbUtils";
import { extendBreadcrumbs } from "~/utils/extendBreadcrumbs";
import { getRunData } from "~/utils/loaderUtils";

import { useBreadcrumbs as useParentBreadcrumbs } from "..";

export const useBreadcrumbs = (
  data: SerializeFrom<LoaderData>
): Breadcrumb[] => {
  return extendBreadcrumbs(
    useParentBreadcrumbs(data.jobSchedule),
    useRunBreadcrumbs(data)
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
