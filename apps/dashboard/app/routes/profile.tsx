import type { UserSchema } from "@enschedule/types";
import { Box, Button, Typography } from "@mui/material";
import type { LoaderFunctionArgs, SerializeFrom } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import type { z } from "zod";
import { RootLayout } from "~/components/Layout";
import { formatDate } from "~/utils/formatDate";
import { getCurrentUser } from "~/utils/user.server";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const user = await getCurrentUser(request, context);
  if (!user) {
    return redirect("/login");
  }
  return json({ user });
};

export default function Profile() {
  const { user } = useLoaderData<typeof loader>();
  return (
    <RootLayout>
      <User user={user} />
    </RootLayout>
  );
}

function User({ user }: { user: SerializeFrom<z.output<typeof UserSchema>> }) {
  return (
    <Box>
      <Typography variant="h4">Profile</Typography>
      <Box py={2}>
        <Typography variant="body2">Username: {user.username}</Typography>
        <Typography variant="body2">Email: {user.email}</Typography>
        <Typography variant="body2">Name: {user.name}</Typography>
        <Typography variant="body2">
          Admin: {user.admin ? "Yes" : "No"}
        </Typography>
        <Typography variant="body2">
          Created At: {formatDate(new Date(user.createdAt)).isoDate}
        </Typography>
      </Box>
      <Box sx={{ display: "flex", gap: 2 }}>
        <Form method="post" action="/refresh">
          <Button
            variant="contained"
            color="primary"
            type="submit"
            data-testid="logout"
            name="logout"
          >
            Logout
          </Button>
        </Form>
        <Form method="post" action="/refresh">
          <Button
            variant="contained"
            color="error"
            type="submit"
            data-testid="logout-all-devices"
            name="logout-all-devices"
          >
            Logout all devices
          </Button>
        </Form>
      </Box>
    </Box>
  );
}
