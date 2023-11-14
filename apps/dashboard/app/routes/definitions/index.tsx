import type { LoaderFunction } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import DefinitionsTable from "~/components/DefinitionsTable";
import { RootLayout } from "~/components/Layout";
import { getWorker } from "~/createWorker";
import type { Breadcrumb, DashboardWorker } from "~/types";

async function getLoaderData(worker: DashboardWorker) {
  const definitions = worker.getDefinitions();
  return definitions;
}

type LoaderData = Awaited<ReturnType<typeof getLoaderData>>;

export const loader: LoaderFunction = async ({ context }) => {
  return json<LoaderData>(await getLoaderData(getWorker(context.worker)));
};

export const useBreadcrumbs = (): Breadcrumb[] => {
  return [
    {
      href: "/definitions",
      title: "Definitions",
    },
  ];
};

export default function Definitions() {
  const definitions = useLoaderData<LoaderData>();

  return (
    <RootLayout
      navbar={{
        title: "Definitions",
        subTitle: "These are the job definitions defined on the server",
      }}
      breadcrumbs={useBreadcrumbs()}
    >
      <DefinitionsTable definitions={definitions} />
    </RootLayout>
  );
}
