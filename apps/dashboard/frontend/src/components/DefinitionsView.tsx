import type { PublicJobDefinition } from "@enschedule/types";
import { Box, Card, CardActions, CardContent, Link as MuiLink, Typography } from "@mui/material";
import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { ClientTable } from "./ClientTable";
import { CodeBlock } from "./CodeBlock";
import { RouteLink } from "./RouteLink";

const helper = createColumnHelper<PublicJobDefinition>();
const columns: ColumnDef<PublicJobDefinition, any>[] = [
  helper.accessor("id", { header: "Id", cell: (info) => <MuiLink component={RouteLink} to={`/definitions/${info.getValue()}`} data-testid="definition-link" onClick={(event) => event.stopPropagation()}>{info.getValue()}</MuiLink> }),
  helper.accessor("title", { header: "Title" }),
  helper.accessor("description", { header: "Description", cell: (info) => info.getValue() || "-" }),
  helper.accessor("version", { header: "Version" }),
];

export function DefinitionsView({ definitions }: { definitions: PublicJobDefinition[] }) {
  return <Box><Typography color="text.secondary" mb={3}>To modify definitions, edit the function code loaded by a worker.</Typography><ClientTable title="Functions" rows={definitions} columns={columns} defaultSorting={[{ id: "title", desc: false }]} renderRow={(row) => row.original.codeBlock ? <Box><Typography variant="h6" mb={1}>Schema</Typography><CodeBlock value={row.original.codeBlock} language="json" /></Box> : null} /></Box>;
}

export function DefinitionDetails({ definition }: { definition: PublicJobDefinition }) {
  return <Box id="DefinitionPage"><Typography color="text.secondary">Schedules create runs against this function with data matching its schema. Update the server-side function registration to modify it.</Typography><Box display="flex" flexWrap="wrap" gap={3} mt={3}>{definition.codeBlock && <Card sx={{ flex: 1, minWidth: 300 }}><CardContent><Typography variant="h6" mb={1}>Schema</Typography><CodeBlock value={definition.codeBlock} language="json" /></CardContent><CardActions /></Card>}{definition.example !== undefined && <Card sx={{ flex: 1, minWidth: 300 }}><CardContent><Typography variant="h6" mb={1}>Example</Typography><CodeBlock value={JSON.stringify(definition.example, null, 2)} language="json" /></CardContent></Card>}</Box><Card sx={{ mt: 3 }}><CardContent><Typography variant="h5" gutterBottom>Details</Typography><Box display="grid" gridTemplateColumns="auto 1fr" gap={1} columnGap={2}><Typography color="text.secondary">ID</Typography><Typography>{definition.id}</Typography><Typography color="text.secondary">Version</Typography><Typography>{definition.version}</Typography></Box></CardContent></Card></Box>;
}
