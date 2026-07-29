import { createFileRoute } from "@richie-router/react";
import { api } from "~/api";
import { Loading } from "~/components/Loading";
import { SchedulesView } from "~/components/SchedulesView";

export const Route = createFileRoute("/definitions/$functionId/schedules")({ component: DefinitionSchedules });

function DefinitionSchedules() {
  const { functionId } = Route.useParams();
  const query = api.listSchedules.useQuery({ queryKey: ["schedules", functionId], queryData: { query: { functionId } }, refetchInterval: 5000 });
  if (!query.data) return <Loading />;
  return <SchedulesView schedules={query.data.payload} />;
}
