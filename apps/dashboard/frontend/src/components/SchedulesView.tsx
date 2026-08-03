import { ScheduleStatus, type PublicJobSchedule } from "@enschedule/types";
import { Box, Button, Link as MuiLink, Typography } from "@mui/material";
import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "../api";
import { ClientTable } from "./ClientTable";
import { RouteLink } from "./RouteLink";
import { Status } from "./Status";

const helper = createColumnHelper<PublicJobSchedule>();
const date = (value: Date | string) => new Date(value).toLocaleString();

const columns: ColumnDef<PublicJobSchedule, any>[] = [
  helper.accessor("status", { header: "Status", cell: (info) => <Status value={info.getValue()} /> }),
  helper.accessor("title", { header: "Title", cell: (info) => <MuiLink component={RouteLink} to={`/schedules/${info.row.original.id}`} data-testid="schedule-link" onClick={(event) => event.stopPropagation()}>{info.getValue()}</MuiLink> }),
  helper.accessor("description", { header: "Description", cell: (info) => info.getValue() || "-" }),
  helper.accessor((schedule) => schedule.runNow ? "Now" : schedule.runAt ? date(schedule.runAt) : "Not scheduled", { id: "runAt", header: "Next scheduled run", cell: (info) => <Typography variant="inherit" data-testid="runAt">{info.getValue()}</Typography> }),
  helper.accessor((schedule) => schedule.lastRun?.startedAt ? date(schedule.lastRun.startedAt) : "-", { id: "lastRun", header: "Last run" }),
  helper.accessor("numRuns", { header: "Number of runs", cell: (info) => <Typography variant="inherit" data-testid="num-runs">{info.getValue()}</Typography> }),
  helper.accessor("retryFailedJobs", { header: "Retry failed jobs", cell: (info) => info.getValue() ? "Yes" : "No" }),
  helper.accessor("maxRetries", { header: "Max retries", cell: (info) => !info.row.original.retryFailedJobs ? "-" : info.getValue() === -1 ? "Unlimited" : info.getValue() }),
  helper.accessor("retries", { header: "Num retries", cell: (info) => !info.row.original.retryFailedJobs ? "-" : info.getValue() }),
  helper.accessor((schedule) => typeof schedule.jobDefinition === "string" ? schedule.jobDefinition : schedule.jobDefinition.title, { id: "definition", header: "Job definition" }),
];

export function SchedulesView({ schedules }: { schedules: PublicJobSchedule[] }) {
  const queryClient = useQueryClient();
  const action = api.scheduleActions.useMutation({ onSuccess: () => void queryClient.invalidateQueries() });
  const submit = (selected: PublicJobSchedule[], type: "run" | "unschedule" | "delete", clear: () => void) => action.mutate({ body: { ids: selected.map(({ id }) => id), action: type } }, { onSuccess: clear });
  const allCan = (selected: PublicJobSchedule[], action: "edit" | "run" | "delete") => selected.every((schedule) => schedule.capabilities[action]);
  return (
    <Box width="100%" id="SchedulesTable">
      <ClientTable title="Schedules" rows={schedules} columns={columns} defaultSorting={[{ id: "runAt", desc: true }]}
        actions={(selected, clear) => <>{allCan(selected, "edit") && <Button color="inherit" data-testid="ms-unschedule" onClick={() => submit(selected, "unschedule", clear)}>Unschedule</Button>}{allCan(selected, "run") && <Button color="inherit" data-testid="ms-run" onClick={() => submit(selected, "run", clear)}>Run</Button>}{allCan(selected, "delete") && <Button color="inherit" data-testid="ms-delete" onClick={() => submit(selected, "delete", clear)}>Delete</Button>}</>}
      />
    </Box>
  );
}
