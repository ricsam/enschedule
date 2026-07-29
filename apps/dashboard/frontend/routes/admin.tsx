import type { z } from "zod";
import type { UserSchema } from "@enschedule/types";
import React from "react";
import { Alert, AlertTitle, Box, Button, Dialog, DialogActions, DialogContent, DialogContentText, DialogTitle, Stack, Typography } from "@mui/material";
import type { ColumnDef } from "@tanstack/react-table";
import { createColumnHelper } from "@tanstack/react-table";
import { createFileRoute } from "@richie-router/react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "~/api";
import { AppShell } from "~/components/AppShell";
import { ClientTable } from "~/components/ClientTable";
import { ErrorPanel } from "~/components/ErrorPanel";
import { Loading } from "~/components/Loading";

export const Route = createFileRoute("/admin")({ component: Admin });
type User = z.output<typeof UserSchema>;
const helper = createColumnHelper<User>();
const columns: ColumnDef<User, any>[] = [
  helper.accessor("username", { header: "Username" }),
  helper.accessor("name", { header: "Name" }),
  helper.accessor("email", { header: "Email", cell: (info) => info.getValue() ?? "-" }),
  helper.accessor("admin", { header: "Admin", cell: (info) => info.getValue() ? "Yes" : "No" }),
  helper.accessor("createdAt", { header: "Created At", cell: (info) => new Date(info.getValue()).toLocaleString(), sortingFn: "datetime" }),
];

function Admin() {
  const queryClient = useQueryClient();
  const users = api.listUsers.useQuery({ queryKey: ["users"], queryData: {} });
  const reset = api.reset.useMutation({ onSuccess: () => void queryClient.invalidateQueries() });
  const [open, setOpen] = React.useState(false);
  const breadcrumbs = [{ title: "Admin area", href: "/admin" }];
  if (users.isLoading) return <AppShell title="Admin area" breadcrumbs={breadcrumbs}><Loading /></AppShell>;
  if (users.error) return <AppShell title="Admin area" breadcrumbs={breadcrumbs}><ErrorPanel error={users.error} /></AppShell>;
  return <AppShell title="Admin area" breadcrumbs={breadcrumbs}><Stack gap={3}><Box><Typography variant="h5" mb={1.5}>Users</Typography><ClientTable id="UsersTable" title="Users" rows={users.data?.payload ?? []} columns={columns} /></Box><Box><Typography variant="h5" mb={1.5}>Danger Zone</Typography><Alert severity="error" variant="outlined" action={<Button color="inherit" variant="outlined" data-testid="reset-enschedule" onClick={() => setOpen(true)}>Delete</Button>}><AlertTitle>Reset Enschedule</AlertTitle>Delete all runs, schedules, and workers.</Alert></Box></Stack><Dialog open={open} onClose={() => setOpen(false)}><DialogTitle>Are you sure you want to reset Enschedule?</DialogTitle><DialogContent><DialogContentText>This will delete all runs, schedules, and workers. It cannot be undone.</DialogContentText></DialogContent><DialogActions><Button onClick={() => setOpen(false)}>Cancel</Button><Button color="error" data-testid="confirm-reset-enschedule" onClick={() => reset.mutate({}, { onSuccess: () => setOpen(false) })}>Reset Enschedule</Button></DialogActions></Dialog></AppShell>;
}
