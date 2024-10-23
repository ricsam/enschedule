import { WorkerStatus, type PublicJobSchedule } from "@enschedule/types";
import type { LoaderFunction, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { Params } from "@remix-run/react";
import { useHref, useLoaderData } from "@remix-run/react";
import { RootLayout } from "~/components/Layout";
import RunsTable from "~/components/RunsTable";
import { getWorker } from "~/createWorker.server";
import type { Breadcrumb, DashboardWorker } from "~/types";
import { extendBreadcrumbs } from "~/utils/extendBreadcrumbs";
import { useBreadcrumbs as useParentBreadcrumbs, useNavbar } from "..";
import { getAuthHeader } from "~/sessions";

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
  worker: DashboardWorker,
  request: Request
) => {
  const authHeader = await getAuthHeader(request);
  const id = getScheduleId(params);
  const schedule = await worker.getSchedule(authHeader, id);
  if (!schedule) {
    throw new Error("invalid id");
  }
  const runs = await worker.getRuns({ scheduleId: schedule.id, authHeader });

  const workers = await worker.getWorkers(authHeader);
  const activeWorkers = workers.filter(
    (worker) =>
      worker.status === WorkerStatus.UP &&
      !!worker.definitions.find((handler) => handler.id === schedule.handlerId)
  );

  return { schedule, runs, activeWorkers };
};

export type LoaderData = Awaited<ReturnType<typeof getLoaderData>>;

export const loader: LoaderFunction = async ({ params, context, request }) => {
  const loaderData = await getLoaderData(
    params,
    await getWorker(context.worker),
    request
  );
  return json(loaderData);
};

export const useData = () => {
  return useLoaderData<LoaderData>();
};

export { action } from "~/components/RunsTable";

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
  const schedulePage = useHref("../", { relative: "path" });
  const runsPage = useHref("", { relative: "path" });
  return (
    <RootLayout
      breadcrumbs={breadcrumbs}
      navbar={useNavbar(schedulePage, runsPage)}
    >
      <RunsTable runs={runs.rows} count={runs.count} />
    </RootLayout>
  );
}
