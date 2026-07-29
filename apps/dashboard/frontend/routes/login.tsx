import React from "react";
import { Alert, Box, Button, Container, TextField, Typography } from "@mui/material";
import { createFileRoute } from "@richie-router/react";
import { useQueryClient } from "@tanstack/react-query";
import { api } from "~/api";
import { AppShell } from "~/components/AppShell";

export const Route = createFileRoute("/login")({ component: Login });

function Login() {
  const queryClient = useQueryClient();
  const search = Route.useSearch();
  const [error, setError] = React.useState("");
  const mutation = api.login.useMutation({ onSuccess: async () => { await queryClient.invalidateQueries(); const redirect = search.redirect?.startsWith("/") ? search.redirect : "/"; window.location.assign(redirect); }, onError: () => setError("Invalid username or password") });
  return <AppShell breadcrumbs={[{ title: "Login", href: "/login" }]}><Container maxWidth="xs"><Box display="flex" flexDirection="column" justifyContent="center" minHeight="calc(100vh - 150px)"><Typography variant="h4" gutterBottom>Login</Typography>{error && <Alert severity="error">{error}</Alert>}<Box component="form" id="login-form" onSubmit={(event) => { event.preventDefault(); const form = new FormData(event.currentTarget); mutation.mutate({ body: { username: String(form.get("username")), password: String(form.get("password")) } }); }}><TextField fullWidth margin="normal" label="Username" name="username" required error={!!error} helperText={error || undefined} onChange={() => setError("")} /><TextField fullWidth margin="normal" label="Password" name="password" type="password" autoComplete="current-password" required error={!!error} onChange={() => setError("")} /><Button sx={{ mt: 2 }} variant="contained" type="submit" disabled={mutation.isPending}>Login</Button></Box></Box></Container></AppShell>;
}
