import type { PublicJobSchedule } from "@enschedule/types";
import type { LoaderFunction, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { Params } from "@remix-run/react";
import { useHref, useLoaderData } from "@remix-run/react";
import { RootLayout } from "~/components/Layout";
import RunsTable from "~/components/RunsTable";
import { getWorker } from "~/createWorker";
import type { Breadcrumb, DashboardWorker } from "~/types";
import { extendBreadcrumbs } from "~/utils/extendBreadcrumbs";
import { useBreadcrumbs as useParentBreadcrumbs, useNavbar } from "..";

export { action } from "~/components/RunsTable";

const getScheduleId = (params: Params<string>): number => {
  const scheduleId = params.scheduleId;
  const id = Number(scheduleId);
  if (Number.isNaN(id)) {
    throw new Error("invalid id");
  }
  return id;
};

export const getLoaderData = async (
  params: Params,
  worker: DashboardWorker
) => {
  const id = getScheduleId(params);
  const schedule = await worker.getSchedule(id);
  if (!schedule) {
    throw new Error("invalid id");
  }
  const runs = await worker.getRuns({ scheduleId: schedule.id });

  return { schedule, runs };
};

export type LoaderData = Awaited<ReturnType<typeof getLoaderData>>;

export const loader: LoaderFunction = async ({ params, context }) => {
  const loaderData = await getLoaderData(params, getWorker(context.worker));
  return json(loaderData);
};

export const useData = () => {
  return useLoaderData<LoaderData>();
};

export const useBreadcrumbs = (
  schedule: SerializeFrom<PublicJobSchedule>
): Breadcrumb[] => {
  return extendBreadcrumbs(useParentBreadcrumbs(schedule), [
    { title: "Runs", href: "/runs" },
  ]);
};

export default function Runs() {
  const { runs, schedule } = useData();
  const breadcrumbs = useBreadcrumbs(schedule);
  const parent = useHref("../", { relative: "path" });
  const thisUrl = useHref("", { relative: "path" });
  return (
    <RootLayout breadcrumbs={breadcrumbs} navbar={useNavbar(parent, thisUrl)}>
      <RunsTable runs={runs} />
    </RootLayout>
  );
}
