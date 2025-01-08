import type { PublicJobDefinition } from "@enschedule/types";
import Button from "@mui/material/Button";
import type { LoaderFunction, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { Params } from "@remix-run/react";
import { Link as RemixLink, useLoaderData } from "@remix-run/react";
import DefinitionPage from "~/components/DefinitionPage";
import { RootLayout } from "~/components/Layout";
import { getWorker } from "~/createWorker.server";
import type { Breadcrumb, DashboardWorker } from "~/types";
import { extendBreadcrumbs } from "~/utils/extendBreadcrumbs";
import { useBreadcrumbs as useParentBreadcrumbs } from "..";
import { getAuthHeader } from "~/sessions";

export const useBreadcrumbs = (
  jobDefinition: SerializeFrom<PublicJobDefinition> | string
): Breadcrumb[] => {
  const parentBreadcrumbs = useParentBreadcrumbs();

  return extendBreadcrumbs(parentBreadcrumbs, [
    {
      href: `/${
        typeof jobDefinition === "string" ? jobDefinition : jobDefinition.id
      }`,
      title:
        typeof jobDefinition === "string"
          ? jobDefinition
          : `${jobDefinition.title} (v${jobDefinition.version})`,
    },
  ]);
};

export async function getLoaderData(
  params: Params<string>,
  worker: DashboardWorker,
  request: Request
) {
  const id = getDefinitionId(params);
  const authHeader = await getAuthHeader(request);
  const def = await worker.getLatestHandler(id, authHeader);
  return { def };
}

export const getDefinitionId = (params: Params<string>): string => {
  const functionId = params.functionId;
  if (!functionId) {
    throw new Error("invalid id");
  }
  return functionId;
};

export type LoaderData = Awaited<ReturnType<typeof getLoaderData>>;

export const loader: LoaderFunction = async ({ params, context, request }) => {
  const loaderData = await getLoaderData(
    params,
    await getWorker(context.worker),
    request
  );
  return json(loaderData);
};

export const useLayout = (def: SerializeFrom<PublicJobDefinition>) => {
  return {
    breadcrumbs: useBreadcrumbs(def),
    navbar: {
      title: def.title,
      subTitle: def.description,
      actions: (
        <>
          <Button
            variant="contained"
            LinkComponent={RemixLink}
            component={RemixLink}
            to={"/run?def=" + def.id}
          >
            Create schedule
          </Button>
        </>
      ),
      tabs: [
        {
          label: "Schema",
          to: `/definitions/${def.id}`,
        },
        {
          label: "Schedules",
          to: `/definitions/${def.id}/schedules`,
        },
      ],
    },
  };
};

export default function SchemaTab() {
  const { def } = useLoaderData<LoaderData>();

  return (
    <RootLayout {...useLayout(def)}>
      <DefinitionPage definition={def}></DefinitionPage>
    </RootLayout>
  );
}
