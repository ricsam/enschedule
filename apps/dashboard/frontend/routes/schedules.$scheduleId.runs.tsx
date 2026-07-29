import { createFileRoute } from "@richie-router/react";
import { api } from "~/api";
import { Loading } from "~/components/Loading";
import { RunsView } from "~/components/RunsView";

export const Route = createFileRoute("/schedules/$scheduleId/runs")({ component: ScheduleRuns });

function ScheduleRuns() {
  const { scheduleId } = Route.useParams();
  const query = api.listRuns.useQuery({ queryKey: ["runs", scheduleId], queryData: { query: { scheduleId: Number(scheduleId) } }, refetchInterval: 3000 });
  if (!query.data) return <Loading />;
  return <RunsView runs={query.data.payload.rows} />;
}
