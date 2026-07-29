import { createFileRoute } from "@richie-router/react";
import { api } from "~/api";
import { DefinitionDetails } from "~/components/DefinitionsView";
import { Loading } from "~/components/Loading";

export const Route = createFileRoute("/definitions/$functionId/")({ component: DefinitionSchema });

function DefinitionSchema() {
  const { functionId } = Route.useParams();
  const query = api.getDefinition.useQuery({ queryKey: ["definition", functionId], queryData: { params: { id: functionId } } });
  if (!query.data) return <Loading />;
  return <DefinitionDetails definition={query.data.payload} />;
}
