import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import DefinitionsTable from "~/components/DefinitionsTable";
import { RootLayout } from "~/components/Layout";
import { getWorker } from "~/createWorker.server";
import type { Breadcrumb, DashboardWorker } from "~/types";

async function getLoaderData(worker: DashboardWorker) {
  const definitions = worker.getLatestHandlers();
  return definitions;
}

type LoaderData = Awaited<ReturnType<typeof getLoaderData>>;

export const loader: LoaderFunction = async ({ context }) => {
  return json<LoaderData>(await getLoaderData(await getWorker(context.worker)));
};

export const useBreadcrumbs = (): Breadcrumb[] => {
  return [
    {
      href: "/definitions",
      title: "Handlers",
    },
  ];
};

export default function Definitions() {
  const definitions = useLoaderData<LoaderData>();

  return (
    <RootLayout
      navbar={{
        title: "Handlers",
        subTitle: "These are the job handlers defined on the server",
      }}
      breadcrumbs={useBreadcrumbs()}
    >
      <DefinitionsTable definitions={definitions} />
    </RootLayout>
  );
}
