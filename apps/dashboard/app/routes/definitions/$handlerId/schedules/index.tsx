import type { PublicJobDefinition, PublicJobSchedule } from "@enschedule/types";
import type { LoaderFunction, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { Params } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import assert from "assert";
import { RootLayout } from "~/components/Layout";
import SchedulesTable from "~/components/SchedulesTable";
import { getWorker } from "~/createWorker.server";
import type { Breadcrumb, DashboardWorker } from "~/types";
import { extendBreadcrumbs } from "~/utils/extendBreadcrumbs";
import { useBreadcrumbs as useParentBreadcrumbs, useLayout } from "..";
import { getAuthHeader } from "~/sessions";

type LoaderData = Awaited<ReturnType<typeof getLoaderData>>;

export async function getLoaderData(
  params: Params<string>,
  worker: DashboardWorker,
  request: Request
): Promise<{
  schedules: PublicJobSchedule[];
  jobDefinition: PublicJobDefinition;
}> {
  const handlerId = params.handlerId;
  assert(handlerId, "You must have a handlerId");
  const authHeader = await getAuthHeader(request);
  const jobDefinition = await worker.getLatestHandler(handlerId, authHeader);
  const schedules = await worker.getSchedules({ handlerId });
  return { schedules, jobDefinition };
}

export const loader: LoaderFunction = async ({ params, context, request }) => {
  return json<LoaderData>(
    await getLoaderData(params, await getWorker(context.worker), request)
  );
};

export { action } from "~/components/SchedulesTable";

export const useData = () => {
  return useLoaderData<LoaderData>();
};

export function Page() {
  const { schedules } = useLoaderData<LoaderData>();

  return <SchedulesTable schedules={schedules} />;
}

export const useBreadcrumbs = (
  jobDefinition: SerializeFrom<PublicJobDefinition> | string
): Breadcrumb[] => {
  const parentBreadcrumbs = useParentBreadcrumbs(jobDefinition);
  return extendBreadcrumbs(parentBreadcrumbs, [
    { href: "/schedules", title: "Schedules" },
  ]);
};

export default function Schedules() {
  const data = useData();
  const def = data.jobDefinition;
  const layout = useLayout(def);
  return (
    <RootLayout {...layout} breadcrumbs={useBreadcrumbs(data.jobDefinition)}>
      <Page />
    </RootLayout>
  );
}
