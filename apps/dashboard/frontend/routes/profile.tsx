import { Box, Button, Stack, Typography } from "@mui/material";
import { createFileRoute, useNavigate } from "@richie-router/react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "~/api";
import { AppShell } from "~/components/AppShell";
import { ErrorPanel } from "~/components/ErrorPanel";
import { Loading } from "~/components/Loading";

export const Route = createFileRoute("/profile")({ component: Profile });

function Profile() {
  const queryClient = useQueryClient();
  const navigate = useNavigate();
  const session = api.session.useQuery({ queryKey: ["session"], queryData: {} });
  const userId = session.data?.payload.user?.userId;
  const user = api.getUser.useQuery({ queryKey: ["user", userId], queryData: { params: { id: userId ?? 1 } }, enabled: !!userId });
  const logout = api.logout.useMutation({
    onSuccess: async () => { queryClient.clear(); await navigate({ to: "/" }); },
  });
  if (session.isLoading || user.isLoading) return <AppShell><Loading /></AppShell>;
  if (!userId) { void navigate({ to: "/login", search: { redirect: "/profile" } }); return null; }
  if (user.error || !user.data) return <AppShell><ErrorPanel error={user.error ?? "User not found"} /></AppShell>;
  const value = user.data.payload;
  return (
    <AppShell title="Profile" breadcrumbs={[{ title: "Profile", href: "/profile" }]}>
      <Typography variant="h5">{value.name}</Typography>
      <Box py={2}><Typography variant="body2">Username: {value.username}</Typography><Typography variant="body2">Email: {value.email ?? "-"}</Typography><Typography variant="body2">Admin: {value.admin ? "Yes" : "No"}</Typography><Typography variant="body2">Created: {new Date(value.createdAt).toLocaleString()}</Typography></Box>
      <Stack direction="row" gap={2}>
        <Button data-testid="logout" variant="contained" onClick={() => logout.mutate({ body: { refreshToken: "cookie", allDevices: false } })}>Logout</Button>
        <Button data-testid="logout-all-devices" color="error" variant="contained" onClick={() => logout.mutate({ body: { refreshToken: "cookie", allDevices: true } })}>Logout all devices</Button>
      </Stack>
    </AppShell>
  );
}
