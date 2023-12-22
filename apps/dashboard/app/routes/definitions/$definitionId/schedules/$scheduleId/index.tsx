import type { LoaderFunction, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { Params } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import { RootLayout } from "~/components/Layout";
import SchedulePage, { Actions } from "~/components/SchedulePage";

import type { PublicJobSchedule } from "@enschedule/types";
import type { Breadcrumb, DashboardWorker } from "~/types";
import { extendBreadcrumbs } from "~/utils/extendBreadcrumbs";
import { useBreadcrumbs as useParentBreadcrumbs } from ".."; // Importing from parent
import { getWorker } from "~/createWorker";

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
  const loaderData = await getLoaderData(params, await getWorker(context.worker));
  return json(loaderData);
};

export const useData = () => {
  return useLoaderData<LoaderData>();
};

export const useBreadcrumbs = (
  schedule: SerializeFrom<PublicJobSchedule>
): Breadcrumb[] => {
  const parentBreadcrumbs = useParentBreadcrumbs(schedule.jobDefinition);
  return extendBreadcrumbs(parentBreadcrumbs, [
    { title: schedule.title, href: "/" + String(schedule.id) },
  ]);
};

export { action } from "~/components/SchedulePage";

export const useNavbar = (action: string, runRedirect: string) => {
  const data = useData();

  const def = data.schedule.jobDefinition;

  const definitionId = typeof def === "string" ? def : def.id;

  return {
    title: data.schedule.title,
    subTitle: data.schedule.description,
    tabs: [
      {
        label: "Details",
        to: `/definitions/${definitionId}/schedules/${data.schedule.id}`,
      },
      {
        label: "Runs",
        to: `/definitions/${definitionId}/schedules/${data.schedule.id}/runs`,
      },
    ],
    actions: <Actions action={action} runRedirect={runRedirect} />,
  };
};

export default function Schedule({ editDetails }: { editDetails?: boolean }) {
  const data = useData();
  const { schedule, runs } = useLoaderData<LoaderData>();
  return (
    <RootLayout
      breadcrumbs={useBreadcrumbs(data.schedule)}
      navbar={useNavbar("", "")}
    >
      <SchedulePage schedule={schedule} runs={runs} editDetails={editDetails} />
    </RootLayout>
  );
}
