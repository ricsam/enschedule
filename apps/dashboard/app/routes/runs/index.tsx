import type { PublicJobRun } from "@enschedule/types";
import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { RootLayout } from "~/components/Layout";
import RunsTable from "~/components/RunsTable";
import { getWorker } from "~/createWorker.server";
import type { Breadcrumb } from "~/types";

export type LoaderData = {
  runs: PublicJobRun[];
};

export { action } from "~/components/RunsTable";

export const loader: LoaderFunction = async ({ request, context }) => {
  // const url = new URL(request.url);
  // const params = url.searchParams;

  const runs: PublicJobRun[] = await (
    await getWorker(context.worker)
  ).getRuns({});
  return json({ runs });
};

export function useData() {
  return useLoaderData<LoaderData>();
}

export const useBreadcrumbs = (): Breadcrumb[] => {
  return [{ title: "Runs", href: "/runs" }];
};

export default function Runs() {
  const { runs } = useData();

  return (
    <RootLayout
      navbar={{
        title: "All Runs",
        subTitle: `Listing all runs in the system.`,
      }}
      breadcrumbs={useBreadcrumbs()}
    >
      <RunsTable runs={runs} />
    </RootLayout>
  );
}
