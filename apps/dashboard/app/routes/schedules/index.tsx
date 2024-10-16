import type { PublicJobDefinition, PublicJobSchedule } from "@enschedule/types";
import { Button } from "@mui/material";
import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { Params } from "@remix-run/react";
import { Link as RemixLink, useLoaderData } from "@remix-run/react";
import { RootLayout } from "~/components/Layout";
import SchedulesTable from "~/components/SchedulesTable";
import { getWorker } from "~/createWorker.server";
import { getAuthHeader } from "~/sessions";
import type { Breadcrumb, DashboardWorker } from "~/types";

type LoaderData = Awaited<ReturnType<typeof getLoaderData>>;

export async function getLoaderData(
  params: Params<string>,
  worker: DashboardWorker,
  request: Request
): Promise<{
  schedules: PublicJobSchedule[];
  definition?: PublicJobDefinition;
}> {
  const handlerId = params.handlerId;
  const authHeader = await getAuthHeader(request);
  const definition = handlerId
    ? await worker.getLatestHandler(handlerId, authHeader)
    : undefined;
  const schedules = await worker.getSchedules({ handlerId });
  return { schedules, definition };
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
  const { schedules } = useData();

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
