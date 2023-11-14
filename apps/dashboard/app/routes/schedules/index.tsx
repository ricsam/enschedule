import type { PublicJobDefinition, PublicJobSchedule } from "@enschedule/types";
import { Button } from "@mui/material";
import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { Params } from "@remix-run/react";
import { Link as RemixLink, useLoaderData } from "@remix-run/react";
import { RootLayout } from "~/components/Layout";
import SchedulesTable from "~/components/SchedulesTable";
import { getWorker } from "~/createWorker";
import type { Breadcrumb, DashboardWorker } from "~/types";

type LoaderData = Awaited<ReturnType<typeof getLoaderData>>;

export async function getLoaderData(
  params: Params<string>,
  worker: DashboardWorker
): Promise<{
  schedules: PublicJobSchedule[];
  definition?: PublicJobDefinition;
}> {
  const definitionId = params.definitionId;
  const definition = definitionId
    ? await worker.getJobDefinition(definitionId)
    : undefined;
  const schedules = await worker.getSchedules(definitionId);
  return { schedules, definition };
}

export const loader: LoaderFunction = async ({ params, context }) => {
  return json<LoaderData>(
    await getLoaderData(params, getWorker(context.worker))
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

export const useBreadcrumbs = (): Breadcrumb[] => {
  return [
    {
      title: "Schedules",
      href: "/schedules",
    },
  ];
};

export default function Schedules() {
  return (
    <RootLayout
      navbar={{
        title: "Schedules",
        subTitle: "All schedules",
        actions: (
          <>
            <Button
              variant="contained"
              LinkComponent={RemixLink}
              component={RemixLink}
              to={"/run"}
            >
              Create schedule
            </Button>
          </>
        ),
      }}
      breadcrumbs={useBreadcrumbs()}
    >
      <Page />
    </RootLayout>
  );
}
