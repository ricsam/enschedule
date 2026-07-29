import { Button } from "@mui/material";
import { Link, createFileRoute } from "@richie-router/react";
import { api } from "~/api";
import { AppShell } from "~/components/AppShell";
import { ErrorPanel } from "~/components/ErrorPanel";
import { Loading } from "~/components/Loading";
import { SchedulesView } from "~/components/SchedulesView";
import { RouteLink } from "~/components/RouteLink";

export const Route = createFileRoute("/schedules/")({ component: Schedules });

function Schedules() {
  const query = api.listSchedules.useQuery({ queryKey: ["schedules"], queryData: { query: {} }, refetchInterval: 5000 });
  const breadcrumbs = [{ title: "Schedules", href: "/schedules" }];
  if (query.isLoading) return <AppShell title="Schedules" breadcrumbs={breadcrumbs}><Loading /></AppShell>;
  if (query.error) return <AppShell title="Schedules" breadcrumbs={breadcrumbs}><ErrorPanel error={query.error} /></AppShell>;
  return <AppShell title="Schedules" subtitle="All schedules" breadcrumbs={breadcrumbs} actions={<Button component={RouteLink} to="/run" variant="contained">Create schedule</Button>}><SchedulesView schedules={query.data?.payload ?? []} /></AppShell>;
}
