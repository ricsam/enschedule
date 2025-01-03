import type { SerializeFrom } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { RootLayout } from "~/components/Layout";
import SchedulePage, { Actions } from "~/components/SchedulePage";

import { type PublicJobSchedule } from "@enschedule/types";
import type { LoaderData } from "~/routes/schedules/$scheduleId/index";
import { useData, loader } from "~/routes/schedules/$scheduleId/index";
import type { Breadcrumb } from "~/types";
import { extendBreadcrumbs } from "~/utils/extendBreadcrumbs";
import { useBreadcrumbs as useParentBreadcrumbs } from ".."; // Importing from parent

export { loader, useData };

export const useBreadcrumbs = (
  schedule: SerializeFrom<PublicJobSchedule>
): Breadcrumb[] => {
  const parentBreadcrumbs = useParentBreadcrumbs(schedule.jobDefinition);
  return extendBreadcrumbs(parentBreadcrumbs, [
    { title: schedule.title, href: "/" + String(schedule.id) },
  ]);
};

export { action } from "~/components/SchedulePage";

export const useNavbar = (action: string) => {
  const data = useData();

  const def = data.schedule.jobDefinition;

  const functionId = typeof def === "string" ? def : def.id;

  return {
    title: data.schedule.title,
    subTitle: data.schedule.description,
    tabs: [
      {
        label: "Details",
        to: `/definitions/${functionId}/schedules/${data.schedule.id}`,
      },
      {
        label: "Runs",
        to: `/definitions/${functionId}/schedules/${data.schedule.id}/runs`,
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
