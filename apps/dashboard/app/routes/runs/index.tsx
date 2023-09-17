import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { PublicJobRun } from "@enschedule/types";
import { RootLayout } from "~/components/Layout";
import RunsTable from "~/components/RunsTable";
import { scheduler } from "~/scheduler.server";
import type { Breadcrumb } from "~/types";
import { z } from "zod";

export type LoaderData = {
  runs: PublicJobRun[];
};

export const action: ActionFunction = async ({ request }) => {
  const fd = await request.formData();
  const action = z
    .union([z.literal("delete"), z.literal("placeholder")])
    .parse(fd.get("action"));
  const selected = z
    .array(z.number().int())
    .parse(fd.getAll("run").map(Number));

  if (action === "delete") {
    const { deletedIds } = await scheduler.deleteRuns(selected);
    return json({
      deletedIds,
    });
  }
  return json({
    success: true,
  });
};

export const loader: LoaderFunction = async ({ request }) => {
  // const url = new URL(request.url);
  // const params = url.searchParams;

  const runs: PublicJobRun[] = await scheduler.getRuns();
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
