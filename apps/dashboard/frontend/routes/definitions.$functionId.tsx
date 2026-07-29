import { Button } from "@mui/material";
import { Outlet, createFileRoute } from "@richie-router/react";
import { api } from "~/api";
import { AppShell } from "~/components/AppShell";
import { ErrorPanel } from "~/components/ErrorPanel";
import { Loading } from "~/components/Loading";
import { RouteLink } from "~/components/RouteLink";

export const Route = createFileRoute("/definitions/$functionId")({ component: DefinitionLayout });

function DefinitionLayout() {
  const { functionId } = Route.useParams();
  const query = api.getDefinition.useQuery({ queryKey: ["definition", functionId], queryData: { params: { id: functionId } } });
  if (query.isLoading) return <AppShell><Loading /></AppShell>;
  if (query.error || !query.data) return <AppShell><ErrorPanel error={query.error ?? "Function not found"} /></AppShell>;
  const definition = query.data.payload;
  const breadcrumbs = [{ title: "Functions", href: "/definitions" }, { title: `${definition.title} (v${definition.version})`, href: `/definitions/${functionId}` }];
  const tabs = [{ label: "Schema", to: `/definitions/${functionId}` }, { label: "Schedules", to: `/definitions/${functionId}/schedules` }];
  return (
    <AppShell title={definition.title} subtitle={definition.description} breadcrumbs={breadcrumbs} tabs={tabs} actions={<Button component={RouteLink} to={`/run?def=${encodeURIComponent(definition.id)}`} variant="contained">Create schedule</Button>}>
      <Outlet />
    </AppShell>
  );
}
