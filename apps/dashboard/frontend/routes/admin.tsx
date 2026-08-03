import React from "react";
import type { Group } from "@enschedule/types";
import type { z } from "zod";
import type { UserSchema } from "@enschedule/types";
import {
  Alert,
  AlertTitle,
  Autocomplete,
  Box,
  Button,
  Chip,
  Dialog,
  DialogActions,
  DialogContent,
  DialogContentText,
  DialogTitle,
  Stack,
  Tab,
  Tabs,
  TextField,
  Typography,
} from "@mui/material";
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
const userHelper = createColumnHelper<User>();
const userColumns: ColumnDef<User, any>[] = [
  userHelper.accessor("username", { header: "Username" }),
  userHelper.accessor("name", { header: "Name" }),
  userHelper.accessor("email", { header: "Email", cell: (info) => info.getValue() ?? "-" }),
  userHelper.accessor("admin", { header: "Admin", cell: (info) => info.getValue() ? "Yes" : "No" }),
  userHelper.accessor("createdAt", { header: "Created at", cell: (info) => new Date(info.getValue()).toLocaleString(), sortingFn: "datetime" }),
];

function GroupDialog({ group, users, open, onClose }: {
  group?: Group;
  users: User[];
  open: boolean;
  onClose: () => void;
}) {
  const queryClient = useQueryClient();
  const create = api.createGroup.useMutation();
  const update = api.updateGroup.useMutation();
  const [key, setKey] = React.useState("");
  const [title, setTitle] = React.useState("");
  const [description, setDescription] = React.useState("");
  const [members, setMembers] = React.useState<User[]>([]);

  React.useEffect(() => {
    setKey(group?.key ?? "");
    setTitle(group?.title ?? "");
    setDescription(group?.description ?? "");
    setMembers(users.filter(({ id }) => group?.memberIds.includes(id)));
  }, [group, open, users]);

  const save = () => {
    const memberIds = members.map(({ id }) => id);
    const done = () => {
      void queryClient.invalidateQueries({ queryKey: ["groups"] });
      void queryClient.invalidateQueries({ queryKey: ["access-diagnostics"] });
      onClose();
    };
    if (group) {
      update.mutate({ params: { id: group.id }, body: { title, description: description || undefined, memberIds } }, { onSuccess: done });
    } else {
      create.mutate({ body: { key, title, description: description || undefined, memberIds } }, { onSuccess: done });
    }
  };
  const error = create.error ?? update.error;

  return <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
    <DialogTitle>{group ? "Edit group" : "Create group"}</DialogTitle>
    <DialogContent>
      <Stack gap={2} pt={1}>
        <TextField label="Group key" value={key} onChange={(event) => setKey(event.target.value)} disabled={!!group} required helperText={group ? "Group keys are immutable." : "Lowercase letters, numbers, and hyphens. Use this key in function declarations."} inputProps={{ "data-testid": "group-key" }} />
        <TextField label="Title" value={title} onChange={(event) => setTitle(event.target.value)} required inputProps={{ "data-testid": "group-title" }} />
        <TextField label="Description" value={description} onChange={(event) => setDescription(event.target.value)} multiline minRows={2} />
        <Autocomplete multiple options={users} value={members} onChange={(_event, value) => setMembers(value)} getOptionLabel={(user) => `${user.name} (${user.username})`} isOptionEqualToValue={(left, right) => left.id === right.id} renderInput={(params) => <TextField {...params} label="Members" helperText="Membership changes take effect immediately." />} />
        {error && <Alert severity="error">{error instanceof Error ? error.message : "Could not save group"}</Alert>}
      </Stack>
    </DialogContent>
    <DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={save} disabled={!title || (!group && !key) || create.isPending || update.isPending}>Save</Button></DialogActions>
  </Dialog>;
}

function GroupsSection({ groups, users }: { groups: Group[]; users: User[] }) {
  const queryClient = useQueryClient();
  const remove = api.deleteGroup.useMutation();
  const [editing, setEditing] = React.useState<Group>();
  const [creating, setCreating] = React.useState(false);
  const [deleting, setDeleting] = React.useState<Group>();
  const columns = React.useMemo<ColumnDef<Group, any>[]>(() => {
    const helper = createColumnHelper<Group>();
    return [
      helper.accessor("key", { header: "Key", cell: (info) => <Chip size="small" label={info.getValue()} /> }),
      helper.accessor("title", { header: "Title" }),
      helper.accessor("description", { header: "Description", cell: (info) => info.getValue() ?? "-" }),
      helper.accessor((group) => group.memberIds.map((id) => users.find((user) => user.id === id)?.username ?? `#${id}`).join(", ") || "-", { id: "members", header: "Members" }),
      helper.display({ id: "actions", header: "Actions", cell: (info) => <Stack direction="row" gap={1}><Button size="small" onClick={() => setEditing(info.row.original)}>Edit</Button><Button size="small" color="error" onClick={() => setDeleting(info.row.original)}>Delete</Button></Stack> }),
    ];
  }, [users]);
  const deleted = () => {
    void queryClient.invalidateQueries({ queryKey: ["groups"] });
    void queryClient.invalidateQueries({ queryKey: ["access-diagnostics"] });
    setDeleting(undefined);
  };
  return <Stack gap={2}>
    <Box display="flex" justifyContent="space-between" alignItems="center"><Box><Typography variant="h5">Groups</Typography><Typography color="text.secondary">Use immutable group keys in worker and function access declarations.</Typography></Box><Button variant="contained" onClick={() => setCreating(true)} data-testid="create-group">Create group</Button></Box>
    <ClientTable id="GroupsTable" title="Groups" rows={groups} columns={columns} />
    <GroupDialog users={users} open={creating} onClose={() => setCreating(false)} />
    <GroupDialog users={users} group={editing} open={!!editing} onClose={() => setEditing(undefined)} />
    <Dialog open={!!deleting} onClose={() => setDeleting(undefined)}><DialogTitle>Delete {deleting?.title}?</DialogTitle><DialogContent><DialogContentText>This revokes all memberships and materialized run grants for <strong>{deleting?.key}</strong>. Code references become unresolved and deny access until updated.</DialogContentText></DialogContent><DialogActions><Button onClick={() => setDeleting(undefined)}>Cancel</Button><Button color="error" data-testid="confirm-delete-group" onClick={() => deleting && remove.mutate({ params: { id: deleting.id } }, { onSuccess: deleted })}>Delete group</Button></DialogActions></Dialog>
  </Stack>;
}

function Admin() {
  const queryClient = useQueryClient();
  const session = api.session.useQuery({ queryKey: ["session"], queryData: {}, retry: false });
  const users = api.listUsers.useQuery({ queryKey: ["users"], queryData: {}, retry: false });
  const groups = api.listGroups.useQuery({ queryKey: ["groups"], queryData: {}, retry: false });
  const diagnostics = api.accessDiagnostics.useQuery({ queryKey: ["access-diagnostics"], queryData: {}, retry: false });
  const reset = api.reset.useMutation({ onSuccess: () => void queryClient.invalidateQueries() });
  const [tab, setTab] = React.useState(0);
  const [resetOpen, setResetOpen] = React.useState(false);
  const breadcrumbs = [{ title: "Admin area", href: "/admin" }];
  const allowed = session.data?.payload.noAuth || session.data?.payload.user?.admin;
  if (session.isLoading || users.isLoading || groups.isLoading || diagnostics.isLoading) return <AppShell title="Admin area" breadcrumbs={breadcrumbs}><Loading /></AppShell>;
  if (!allowed) return <AppShell title="Admin area" breadcrumbs={breadcrumbs}><Alert severity="error">Administrator access required.</Alert></AppShell>;
  const error = users.error ?? groups.error ?? diagnostics.error;
  if (error) return <AppShell title="Admin area" breadcrumbs={breadcrumbs}><ErrorPanel error={error} /></AppShell>;
  return <AppShell title="Admin area" breadcrumbs={breadcrumbs}>
    <Tabs value={tab} onChange={(_event, value) => setTab(value)} sx={{ mb: 3 }}><Tab label="Users" /><Tab label="Groups" /><Tab label={`Access diagnostics (${diagnostics.data?.payload.length ?? 0})`} /><Tab label="Danger zone" /></Tabs>
    {tab === 0 && <Stack gap={2}><Box><Typography variant="h5">Users</Typography><Typography color="text.secondary">Users are assigned to groups from the Groups tab.</Typography></Box><ClientTable id="UsersTable" title="Users" rows={users.data?.payload ?? []} columns={userColumns} /></Stack>}
    {tab === 1 && <GroupsSection groups={groups.data?.payload ?? []} users={users.data?.payload ?? []} />}
    {tab === 2 && <Stack gap={2}><Box><Typography variant="h5">Access diagnostics</Typography><Typography color="text.secondary">Unknown declaration keys fail closed. Create the missing group or update the declaration.</Typography></Box>{diagnostics.data?.payload.length ? diagnostics.data.payload.map((diagnostic) => <Alert key={diagnostic.key} severity="warning"><AlertTitle>Unknown group: {diagnostic.key}</AlertTitle>{diagnostic.references.join(", ")}</Alert>) : <Alert severity="success">All referenced group keys resolve.</Alert>}</Stack>}
    {tab === 3 && <Alert severity="error" variant="outlined" action={<Button color="inherit" variant="outlined" data-testid="reset-enschedule" onClick={() => setResetOpen(true)}>Delete</Button>}><AlertTitle>Reset Enschedule</AlertTitle>Delete all runs, schedules, and workers.</Alert>}
    <Dialog open={resetOpen} onClose={() => setResetOpen(false)}><DialogTitle>Are you sure you want to reset Enschedule?</DialogTitle><DialogContent><DialogContentText>This will delete all runs, schedules, and workers. It cannot be undone.</DialogContentText></DialogContent><DialogActions><Button onClick={() => setResetOpen(false)}>Cancel</Button><Button color="error" data-testid="confirm-reset-enschedule" onClick={() => reset.mutate({}, { onSuccess: () => setResetOpen(false) })}>Reset Enschedule</Button></DialogActions></Dialog>
  </AppShell>;
}
