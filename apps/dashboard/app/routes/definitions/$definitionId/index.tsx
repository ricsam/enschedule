import type { PublicJobDefinition } from "@enschedule/types";
import Button from "@mui/material/Button";
import type { LoaderFunction, SerializeFrom } from "@remix-run/node";
import { json } from "@remix-run/node";
import type { Params } from "@remix-run/react";
import { Link as RemixLink, useLoaderData } from "@remix-run/react";
import DefinitionPage from "~/components/DefinitionPage";
import { RootLayout } from "~/components/Layout";
import { scheduler } from "~/scheduler.server";
import type { Breadcrumb } from "~/types";
import { extendBreadcrumbs } from "~/utils/extendBreadcrumbs";
import { useBreadcrumbs as useParentBreadcrumbs } from "..";

export const useBreadcrumbs = (
  jobDefinition: SerializeFrom<PublicJobDefinition>
): Breadcrumb[] => {
  const parentBreadcrumbs = useParentBreadcrumbs();

  return extendBreadcrumbs(parentBreadcrumbs, [
    { href: `/${jobDefinition.id}`, title: jobDefinition.title },
  ]);
};

export async function getLoaderData(params: Params<string>) {
  const id = getDefinitionId(params);
  const def = await scheduler.getJobDefinition(id);
  return { def };
}

export const getDefinitionId = (params: Params<string>): string => {
  const definitionId = params.definitionId;
  if (!definitionId) {
    throw new Error("invalid id");
  }
  return definitionId;
};

export type LoaderData = Awaited<ReturnType<typeof getLoaderData>>;

export const loader: LoaderFunction = async ({ params }) => {
  const loaderData = await getLoaderData(params);
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
