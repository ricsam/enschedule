import type { ListRunsOptions, PublicJobRun } from "@enschedule/types";
import type { LoaderFunctionArgs, TypedResponse } from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import { RootLayout } from "~/components/Layout";
import RunsTable from "~/components/RunsTable";
import { getWorker } from "~/createWorker.server";
import { getAuthHeader } from "~/sessions";
import type { Breadcrumb } from "~/types";

export type LoaderData = {
  rows: PublicJobRun[];
  count: number;
};

export { action } from "~/components/RunsTable";

export const loader = async ({
  request,
  context,
}: LoaderFunctionArgs): Promise<TypedResponse<LoaderData>> => {
  const authHeader = await getAuthHeader(request);
  const url = new URL(request.url);

  let limit = 25;
  const rpp = url.searchParams.get("rowsPerPage");
  if (rpp) {
    limit = Number(rpp);
  }

  let offset = 0;
  if (url.searchParams.has("page")) {
    offset = (Number(url.searchParams.get("page")) - 1) * limit;
  }

  const searchParams = url.searchParams;

  const defaultSorting: ListRunsOptions["order"] = [["startedAt", "DESC"]];

  const getOrder = (): ListRunsOptions["order"] => {
    const urlSorting = searchParams.getAll("sorting");
    if (urlSorting) {
      const listOfSortings: ListRunsOptions["order"] = searchParams
        .getAll("sorting")
        .map((value) => {
          const [id, sorting] = value.split(".");
          return [id, sorting === "desc" ? "DESC" : "ASC"];
        });
      if (listOfSortings.length > 0) {
        return listOfSortings;
      }
      return defaultSorting;
    }
    return defaultSorting;
  };

  const order = getOrder();

  console.log("limit, offset, sorting", limit, offset, order);

  const runs: { rows: PublicJobRun[]; count: number } = await (
    await getWorker(context.worker)
  ).getRuns({ authHeader, limit, offset, order });
  return json(runs);
};

export function useData() {
  return useLoaderData<LoaderData>();
}

export const useBreadcrumbs = (): Breadcrumb[] => {
  return [{ title: "Runs", href: "/runs" }];
};

export default function Runs() {
  const { rows, count } = useData();

  return (
    <RootLayout
      navbar={{
        title: "All Runs",
        subTitle: `Listing all runs in the system.`,
      }}
      breadcrumbs={useBreadcrumbs()}
    >
      <RunsTable runs={rows} count={count} />
    </RootLayout>
  );
}
