import { Button, Snackbar, Stack } from "@mui/material";
import { Outlet, createFileRoute, useNavigate } from "@richie-router/react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "~/api";
import { AppShell } from "~/components/AppShell";
import { ErrorPanel } from "~/components/ErrorPanel";
import { Loading } from "~/components/Loading";

export const Route = createFileRoute("/schedules/$scheduleId")({ component: ScheduleLayout });

function ScheduleLayout() {
  const { scheduleId } = Route.useParams();
  const id = Number(scheduleId);
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const query = api.getSchedule.useQuery({ queryKey: ["schedule", id], queryData: { params: { id } }, refetchInterval: 3000 });
  const run = api.runSchedule.useMutation({ onSuccess: () => void queryClient.invalidateQueries() });
  const remove = api.deleteSchedule.useMutation({ onSuccess: () => navigate({ to: "/schedules" }) });
  if (query.isLoading) return <AppShell><Loading /></AppShell>;
  if (query.error || !query.data) return <AppShell><ErrorPanel error={query.error ?? "Schedule not found"} /></AppShell>;
  const schedule = query.data.payload;
  const breadcrumbs = [{ title: "Schedules", href: "/schedules" }, { title: schedule.title, href: `/schedules/${scheduleId}` }];
  const tabs = [{ label: "Details", to: `/schedules/${scheduleId}` }, { label: "Runs", to: `/schedules/${scheduleId}/runs` }];
  return (
    <AppShell title={schedule.title} subtitle={schedule.description} breadcrumbs={breadcrumbs} tabs={tabs} actions={<Stack direction="row" gap={1}><Button variant="outlined" color="inherit" data-testid="delete-schedule" onClick={() => remove.mutate({ params: { id } })}>Delete</Button><Button variant="contained" data-testid="run-now" disabled={schedule.runNow || run.isPending} onClick={() => run.mutate({ params: { id } })}>Run now</Button></Stack>}>
      <Outlet />
      <Snackbar open={run.isSuccess} autoHideDuration={4000} data-testid="run-now-snackbar" message="This job has been marked to run on the next worker tick." />
    </AppShell>
  );
}
