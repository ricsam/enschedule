import type { PublicWorker } from "@enschedule/types";
import { Button, Link as MuiLink, Typography } from "@mui/material";
import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { createFileRoute } from "@richie-router/react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "~/api";
import { AppShell } from "~/components/AppShell";
import { ClientTable } from "~/components/ClientTable";
import { ErrorPanel } from "~/components/ErrorPanel";
import { Loading } from "~/components/Loading";
import { RouteLink } from "~/components/RouteLink";
import { Status } from "~/components/Status";

export const Route = createFileRoute("/workers/")({ component: Workers });
const helper = createColumnHelper<PublicWorker>();
const columns: ColumnDef<PublicWorker, any>[] = [
  helper.accessor("status", { header: "Status", cell: (info) => <Status value={info.getValue()} /> }),
  helper.accessor("title", { header: "Title", cell: (info) => <MuiLink component={RouteLink} to={`/workers/${info.row.original.id}`} data-testid="worker-link" onClick={(event) => event.stopPropagation()}>{info.getValue()}</MuiLink> }),
  helper.accessor("workerId", { header: "ID" }),
  helper.accessor("description", { header: "Description", cell: (info) => info.getValue() || "-" }),
  helper.accessor("version", { header: "Version" }),
  helper.accessor("hostname", { header: "Hostname" }),
  helper.accessor("instanceId", { header: "Instance ID" }),
  helper.accessor("versionHash", { header: "Version hash" }),
  helper.accessor("pollInterval", { header: "Poll interval (s)" }),
  helper.accessor("lastReached", { header: "Last reached", cell: (info) => <Typography variant="inherit">{new Date(info.getValue()).toLocaleString()}</Typography>, sortingFn: "datetime" }),
  helper.accessor("createdAt", { header: "Created", cell: (info) => new Date(info.getValue()).toLocaleString(), sortingFn: "datetime" }),
  helper.accessor((worker) => worker.runs.length, { id: "runs", header: "Runs" }),
  helper.accessor((worker) => worker.definitions.length, { id: "definitions", header: "Functions" }),
];

function Workers() {
  const queryClient = useQueryClient();
  const query = api.listWorkers.useQuery({ queryKey: ["workers"], queryData: {}, refetchInterval: 5000 });
  const remove = api.deleteWorkers.useMutation({ onSuccess: () => void queryClient.invalidateQueries({ queryKey: ["workers"] }) });
  const breadcrumbs = [{ title: "Workers", href: "/workers" }];
  if (query.isLoading) return <AppShell title="Workers" breadcrumbs={breadcrumbs}><Loading /></AppShell>;
  if (query.error) return <AppShell title="Workers" breadcrumbs={breadcrumbs}><ErrorPanel error={query.error} retry={() => query.refetch()} /></AppShell>;
  return <AppShell title="Workers" subtitle="Deployed worker instances" breadcrumbs={breadcrumbs}><ClientTable id="WorkersTable" title="Workers" rows={query.data?.payload ?? []} columns={columns} defaultSorting={[{ id: "lastReached", desc: true }]} actions={(selected, clear) => <Button data-testid="ms-delete" color="inherit" onClick={() => remove.mutate({ body: { ids: selected.map(({ id }) => id) } }, { onSuccess: clear })}>Delete</Button>} /></AppShell>;
}
