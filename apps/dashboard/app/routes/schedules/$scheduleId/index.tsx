import type { PublicJobSchedule } from "@enschedule/types";
import type { LoaderFunction, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { Params } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import { RootLayout } from "~/components/Layout";
import SchedulePage, {
  Actions,
  getScheduleId,
} from "~/components/SchedulePage";
import { scheduler } from "~/scheduler.server";
import type { Breadcrumb } from "~/types";
import { extendBreadcrumbs } from "~/utils/extendBreadcrumbs";
import { useBreadcrumbs as useParentBreadcrumbs } from ".."; // Importing from parent
export { action } from "~/components/SchedulePage";

export const getLoaderData = async (params: Params) => {
  const id = getScheduleId(params);
  const schedule = await scheduler.getSchedule(id);
  if (!schedule) {
    throw new Error("invalid id");
  }
  const runs = await scheduler.getRuns(schedule.id);

  return { schedule, runs };
};

export type LoaderData = Awaited<ReturnType<typeof getLoaderData>>;

export const loader: LoaderFunction = async ({ params }) => {
  const loaderData = await getLoaderData(params);
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

export function Page() {
  const { schedule, runs } = useLoaderData<LoaderData>();
  return <SchedulePage schedule={schedule} runs={runs} />;
}

export const useNavbar = (action: string, runRedirect: string) => {
  const data = useData();

  return {
    title: data.schedule.title,
    subTitle: data.schedule.description,
    tabs: [
      {
        label: "Details",
        to: `/schedules/${data.schedule.id}`,
      },
      {
        label: "Runs",
        to: `/schedules/${data.schedule.id}/runs`,
      },
    ],
    actions: <Actions action={action} runRedirect={runRedirect} />,
  };
};

export default function Schedule() {
  const data = useData();
  return (
    <RootLayout
      breadcrumbs={useBreadcrumbs(data.schedule)}
      navbar={useNavbar("", "")}
    >
      <Page />
    </RootLayout>
  );
}
