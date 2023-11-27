import type { PublicWorkerSchema } from "@enschedule/types";
import { Button } from "@mui/material";
import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { Params } from "@remix-run/react";
import { Link as RemixLink, useLoaderData } from "@remix-run/react";
import type { z } from "zod";
import { RootLayout } from "~/components/Layout";
import WorkersTable from "~/components/WorkersTable";
import { getWorker } from "~/createWorker";
import type { Breadcrumb, DashboardWorker } from "~/types";

export const useBreadcrumbs = (): Breadcrumb[] => {
  return [
    {
      title: "Workers",
      href: "/workers",
    },
  ];
};

export async function getLoaderData(
  params: Params<string>,
  worker: DashboardWorker
): Promise<{
  workers: z.output<typeof PublicWorkerSchema>[];
}> {
  const workers = await worker.getWorkers();
  return { workers };
}

export const loader: LoaderFunction = async ({ params, context }) => {
  const worker = getWorker(context.worker);
  return json<LoaderData>(await getLoaderData(params, worker));
};

type LoaderData = Awaited<ReturnType<typeof getLoaderData>>;

export const useData = () => {
  return useLoaderData<LoaderData>();
};

export function Page() {
  const { workers } = useData();

  return <WorkersTable workers={workers} />;
}

export default function Workers() {
  return (
    <RootLayout
      navbar={{
        title: "Workers",
        subTitle: "These are the deployed workers",
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
