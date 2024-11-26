import { WorkerStatus, type PublicJobSchedule } from "@enschedule/types";
import type { LoaderFunction, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { Params } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import { RootLayout } from "~/components/Layout";
import SchedulePage, {
  Actions,
  getScheduleId,
} from "~/components/SchedulePage";
import { getWorker } from "~/createWorker.server";
import type { Breadcrumb, DashboardWorker, NavBar } from "~/types";
import { extendBreadcrumbs } from "~/utils/extendBreadcrumbs";
import { useBreadcrumbs as useParentBreadcrumbs } from ".."; // Importing from parent
import { getAuthHeader } from "~/sessions";
export { action } from "~/components/SchedulePage";

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


  const workers = await worker.getWorkers(authHeader);
  const activeWorkers = workers.filter(
    (worker) =>
      worker.status === WorkerStatus.UP &&
      !!worker.definitions.find((handler) => handler.id === schedule.handlerId)
  );

  return { schedule, activeWorkers };
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

export const useBreadcrumbs = (
  schedule: SerializeFrom<PublicJobSchedule>
): Breadcrumb[] => {
  const parentBreadcrumbs = useParentBreadcrumbs();
  return extendBreadcrumbs(parentBreadcrumbs, [
    { title: schedule.title, href: "/" + String(schedule.id) },
  ]);
};

export const useNavbar = (action: string): NavBar => {
  const data = useData();

  return {
    title: data.schedule.title,
    subTitle: data.schedule.description,
    tabs: [
      {
        label: "Details",
        to: `/schedules/${data.schedule.id}`,
        match: [
          `/schedules/${data.schedule.id}`,
          `/schedules/${data.schedule.id}/edit-details`,
        ],
      },
      {
        label: "Runs",
        to: `/schedules/${data.schedule.id}/runs`,
      },
    ],
    actions: (
      <Actions
        action={action}
        pendingRunNow={data.schedule.runNow}
        activeWorkers={data.activeWorkers}
      />
    ),
  };
};

export default function Schedule({ editDetails }: { editDetails?: boolean }) {
  const data = useData();
  const { schedule } = useLoaderData<LoaderData>();

  return (
    <RootLayout
      breadcrumbs={useBreadcrumbs(data.schedule)}
      navbar={useNavbar("")}
    >
      <SchedulePage schedule={schedule} editDetails={editDetails} />
    </RootLayout>
  );
}
