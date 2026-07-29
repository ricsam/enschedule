import { Box, Card, CardContent, Chip, Grid, Typography } from "@mui/material";
import { createFileRoute } from "@richie-router/react";
import { api } from "~/api";
import { AppShell } from "~/components/AppShell";
import { ErrorPanel } from "~/components/ErrorPanel";
import { Loading } from "~/components/Loading";
import { Status } from "~/components/Status";

export const Route = createFileRoute("/workers/$workerId")({ component: WorkerDetails });

function WorkerDetails() {
  const { workerId } = Route.useParams();
  const query = api.listWorkers.useQuery({ queryKey: ["workers"], queryData: {}, refetchInterval: 5000 });
  if (query.isLoading) return <AppShell><Loading /></AppShell>;
  const worker = query.data?.payload.find(({ id }) => id === Number(workerId));
  if (query.error || !worker) return <AppShell><ErrorPanel error={query.error ?? "Worker not found"} /></AppShell>;
  return (
    <AppShell title={worker.title} subtitle={worker.description} breadcrumbs={[{ title: "Workers", href: "/workers" }, { title: worker.title, href: `/workers/${workerId}` }]}>
      <Grid container spacing={2}>
        <Grid size={{ xs: 12, md: 6 }}><Card><CardContent><Typography variant="h5" gutterBottom>Details</Typography><Box display="grid" gridTemplateColumns="auto 1fr" gap={1} columnGap={2}><Typography color="text.secondary">Status</Typography><Status value={worker.status} /><Typography color="text.secondary">Worker ID</Typography><Typography>{worker.workerId}</Typography><Typography color="text.secondary">Instance</Typography><Typography>{worker.instanceId}</Typography><Typography color="text.secondary">Version</Typography><Typography>{worker.version} ({worker.versionHash})</Typography><Typography color="text.secondary">Hostname</Typography><Typography>{worker.hostname}</Typography><Typography color="text.secondary">Poll interval</Typography><Typography>{worker.pollInterval}s</Typography></Box></CardContent></Card></Grid>
        <Grid size={{ xs: 12, md: 6 }}><Card><CardContent><Typography variant="h6" gutterBottom>Functions</Typography>{worker.definitions.map((definition) => <Chip key={`${definition.id}-${definition.version}`} label={`${definition.title} v${definition.version}`} sx={{ m: .5 }} />)}</CardContent></Card></Grid>
      </Grid>
    </AppShell>
  );
}
