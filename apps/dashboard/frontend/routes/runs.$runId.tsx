import { Button } from "@mui/material";
import { createFileRoute, useNavigate } from "@richie-router/react";
import { api } from "~/api";
import { AppShell } from "~/components/AppShell";
import { ErrorPanel } from "~/components/ErrorPanel";
import { Loading } from "~/components/Loading";
import { RunDetails } from "~/components/RunDetails";

export const Route = createFileRoute("/runs/$runId")({ component: Run });

function Run() {
  const { runId } = Route.useParams();
  const navigate = useNavigate();
  const query = api.getRun.useQuery({ queryKey: ["run", runId], queryData: { params: { id: Number(runId) } }, refetchInterval: 3000 });
  const remove = api.deleteRun.useMutation({ onSuccess: () => navigate({ to: "/runs", search: { page: 1, rowsPerPage: 25 } }) });
  if (query.isLoading) return <AppShell><Loading /></AppShell>;
  if (query.error || !query.data) return <AppShell><ErrorPanel error={query.error ?? "Run not found"} /></AppShell>;
  const run = query.data.payload;
  return <AppShell title={`Run #${runId}`} breadcrumbs={[{ title: "Runs", href: "/runs" }, { title: `Run #${runId}`, href: `/runs/${runId}` }]} actions={run.capabilities.delete ? <Button variant="outlined" color="inherit" data-testid="delete-run" onClick={() => remove.mutate({ params: { id: Number(runId) } })}>Delete</Button> : undefined}><RunDetails run={run} /></AppShell>;
}
