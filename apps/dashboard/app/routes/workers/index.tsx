import type { PublicWorkerSchema } from "@enschedule/types";
import type { ActionFunction, LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { Params } from "@remix-run/react";
import { useLoaderData } from "@remix-run/react";
import { z } from "zod";
import { RootLayout } from "~/components/Layout";
import WorkersTable from "~/components/WorkersTable";
import { getWorker } from "~/createWorker.server";
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
  const worker = await getWorker(context.worker);
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

export const action: ActionFunction = async ({ request, context }) => {
  const fd = await request.formData();
  const action = z.literal("delete").parse(fd.get("action"));
  const selected = z.array(z.number().int()).parse(fd.getAll("id").map(Number));
  if (action === "delete") {
    await (await getWorker(context.worker)).deleteWorkers(selected);
  }
  return json({ success: true });
};

export default function Workers() {
  return (
    <RootLayout
      navbar={{
        title: "Workers",
        subTitle: "These are the deployed workers",
      }}
      breadcrumbs={useBreadcrumbs()}
    >
      <Page />
    </RootLayout>
  );
}
