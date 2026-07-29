import { createFileRoute } from "@richie-router/react";
import { api } from "~/api";
import { Loading } from "~/components/Loading";
import { RunDetails } from "~/components/RunDetails";

export const Route = createFileRoute("/schedules/$scheduleId/runs/$runId")({ component: NestedRun });

function NestedRun() {
  const { runId } = Route.useParams();
  const query = api.getRun.useQuery({ queryKey: ["run", runId], queryData: { params: { id: Number(runId) } }, refetchInterval: 3000 });
  if (!query.data) return <Loading />;
  return <RunDetails run={query.data.payload} />;
}
