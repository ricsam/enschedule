import { createFileRoute } from "@richie-router/react";
import { api } from "~/api";
import { AppShell } from "~/components/AppShell";
import { DefinitionsView } from "~/components/DefinitionsView";
import { ErrorPanel } from "~/components/ErrorPanel";
import { Loading } from "~/components/Loading";

export const Route = createFileRoute("/definitions/")({ component: Definitions });

function Definitions() {
  const query = api.listDefinitions.useQuery({ queryKey: ["definitions"], queryData: {}, refetchInterval: 5000 });
  if (query.isLoading) return <AppShell title="Functions" breadcrumbs={[{ title: "Functions", href: "/definitions" }]}><Loading /></AppShell>;
  if (query.error) return <AppShell title="Functions" breadcrumbs={[{ title: "Functions", href: "/definitions" }]}><ErrorPanel error={query.error} /></AppShell>;
  return <AppShell title="Functions" subtitle="Versioned functions defined on active workers" breadcrumbs={[{ title: "Functions", href: "/definitions" }]}><DefinitionsView definitions={query.data?.payload ?? []} /></AppShell>;
}
