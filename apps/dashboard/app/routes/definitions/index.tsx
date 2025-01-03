import type { AuthHeader } from "@enschedule/types";
import type { LoaderFunction } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { z } from "zod";
import DefinitionsTable from "~/components/DefinitionsTable";
import { RootLayout } from "~/components/Layout";
import { getWorker } from "~/createWorker.server";
import { getAuthHeader } from "~/sessions";
import type { Breadcrumb, DashboardWorker } from "~/types";

async function getLoaderData(
  worker: DashboardWorker,
  authHeader: z.output<typeof AuthHeader>
) {
  const definitions = worker.getLatestHandlers(authHeader);
  return definitions;
}

type LoaderData = Awaited<ReturnType<typeof getLoaderData>>;

export const loader: LoaderFunction = async ({ context, request }) => {
  const authHeader = await getAuthHeader(request);
  if (!authHeader) {
    return redirect("/login");
  }

  return json<LoaderData>(
    await getLoaderData(await getWorker(context.worker), authHeader)
  );
};

export const useBreadcrumbs = (): Breadcrumb[] => {
  return [
    {
      href: "/definitions",
      title: "Functions",
    },
  ];
};

export default function Definitions() {
  const definitions = useLoaderData<LoaderData>();

  return (
    <RootLayout
      navbar={{
        title: "Function",
        subTitle: "These are the functions defined on the server",
      }}
      breadcrumbs={useBreadcrumbs()}
    >
      <DefinitionsTable definitions={definitions} />
    </RootLayout>
  );
}
