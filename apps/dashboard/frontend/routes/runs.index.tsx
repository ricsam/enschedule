import { createFileRoute } from "@richie-router/react";
import { api } from "~/api";
import { AppShell } from "~/components/AppShell";
import { ErrorPanel } from "~/components/ErrorPanel";
import { Loading } from "~/components/Loading";
import { RunsView } from "~/components/RunsView";

export const Route = createFileRoute("/runs/")({ component: Runs });

function Runs() {
  const query = api.listRuns.useQuery({ queryKey: ["runs", "all"], queryData: { query: {} }, refetchInterval: 5000 });
  const breadcrumbs = [{ title: "Runs", href: "/runs" }];
  if (query.isLoading) return <AppShell title="All Runs" breadcrumbs={breadcrumbs}><Loading /></AppShell>;
  if (query.error) return <AppShell title="All Runs" breadcrumbs={breadcrumbs}><ErrorPanel error={query.error} /></AppShell>;
  return <AppShell title="All Runs" subtitle={`${query.data?.payload.count ?? 0} runs`} breadcrumbs={breadcrumbs}><RunsView runs={query.data?.payload.rows ?? []} /></AppShell>;
}
