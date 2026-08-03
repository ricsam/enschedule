import { RunStatus, type PublicJobRun } from "@enschedule/types";
import { Button, Link as MuiLink, Typography } from "@mui/material";
import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { ClientTable } from "./ClientTable";
import { RouteLink } from "./RouteLink";
import { RunDetails } from "./RunDetails";
import { Status } from "./Status";

const helper = createColumnHelper<PublicJobRun>();
const date = (value: Date | string) => new Date(value).toLocaleString();
const duration = (run: PublicJobRun) => {
  if (run.status === RunStatus.LOST) return "-";
  const milliseconds = (run.finishedAt ? new Date(run.finishedAt).getTime() : Date.now()) - new Date(run.startedAt).getTime();
  if (milliseconds < 1000) return `${milliseconds}ms`;
  if (milliseconds < 60_000) return `${(milliseconds / 1000).toFixed(1)}s`;
  return `${Math.floor(milliseconds / 60_000)}m ${Math.floor((milliseconds % 60_000) / 1000)}s`;
};

const columns: ColumnDef<PublicJobRun, any>[] = [
  helper.accessor("status", { header: "Status", cell: (info) => <Status value={info.getValue()} />, enableSorting: false }),
  helper.accessor("id", { header: "Id", cell: (info) => <MuiLink component={RouteLink} to={`/runs/${info.getValue()}`} data-testid="run-link" onClick={(event) => event.stopPropagation()}>{info.getValue()}</MuiLink> }),
  helper.accessor("startedAt", { header: "Started", cell: (info) => date(info.getValue()), sortingFn: "datetime" }),
  helper.accessor((run) => duration(run), { id: "duration", header: "Duration" }),
  helper.accessor("finishedAt", { header: "Completed", cell: (info) => info.getValue() ? date(info.getValue()!) : "-", sortingFn: "datetime" }),
  helper.accessor((run) => typeof run.worker === "string" ? run.worker : run.worker?.title ?? "Unassigned", {
    id: "worker", header: "Worker", cell: (info) => {
      const worker = info.row.original.worker;
      if (!worker) return "Unassigned";
      if (typeof worker === "string") return `Deleted worker (${worker})`;
      return <MuiLink component={RouteLink} to={`/workers/${worker.id}`} data-testid="worker-link" onClick={(event) => event.stopPropagation()}>{worker.title}</MuiLink>;
    },
  }),
  helper.accessor("scheduledToRunAt", { header: "Scheduled for", cell: (info) => date(info.getValue()), sortingFn: "datetime" }),
  helper.accessor("exitSignal", { header: "Exit signal", cell: (info) => info.getValue() ?? "-" }),
  helper.accessor((run) => typeof run.jobSchedule === "string" ? run.jobSchedule : run.jobSchedule.title, { id: "schedule", header: "Schedule", cell: (info) => {
    const schedule = info.row.original.jobSchedule;
    return typeof schedule === "string" ? `Deleted schedule (${schedule})` : <MuiLink component={RouteLink} to={`/schedules/${schedule.id}`} data-testid="schedule-link" onClick={(event) => event.stopPropagation()}>{schedule.title}</MuiLink>;
  } }),
  helper.accessor((run) => typeof run.jobDefinition === "string" ? run.jobDefinition : run.jobDefinition.title, { id: "definition", header: "Function", cell: (info) => {
    const definition = info.row.original.jobDefinition;
    return typeof definition === "string" ? definition : <MuiLink component={RouteLink} to={`/definitions/${definition.id}`} data-testid="definition-link" onClick={(event) => event.stopPropagation()}>{definition.title} (v{definition.version})</MuiLink>;
  } }),
];

export function RunsView({ runs }: { runs: PublicJobRun[] }) {
  const queryClient = useQueryClient();
  const remove = api.deleteRuns.useMutation({ onSuccess: () => void queryClient.invalidateQueries() });
  return <ClientTable id="RunsTable" title="Runs" rows={runs} columns={columns} defaultSorting={[{ id: "startedAt", desc: true }]}
    renderRow={(row) => <RunDetails run={row.original} />}
    actions={(selected, clear) => selected.every((run) => run.capabilities.delete) ? <Button data-testid="ms-delete" color="inherit" onClick={() => remove.mutate({ body: { ids: selected.map(({ id }) => id) } }, { onSuccess: clear })}>Delete</Button> : null}
  />;
}
