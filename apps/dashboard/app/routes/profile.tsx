import type { UserSchema } from "@enschedule/types";
import { Box, Typography } from "@mui/material";
import type { LoaderFunctionArgs, SerializeFrom} from "@remix-run/node";
import { json } from "@remix-run/node";
import { useLoaderData } from "@remix-run/react";
import type { z } from "zod";
import { RootLayout } from "~/components/Layout";
import { formatDate } from "~/utils/formatDate";
import { getCurrentUser } from "~/utils/user.server";

export const loader = async ({ request, context }: LoaderFunctionArgs) => {
  const user = await getCurrentUser(request, context);
  return json({ user });
};

export default function Profile() {
  const { user } = useLoaderData<typeof loader>();
  return (
    <RootLayout>
      {user ? (
        <User user={user} />
      ) : (
        <Typography variant="h3">Please login to view this page</Typography>
      )}
    </RootLayout>
  );
}

function User({ user }: { user: SerializeFrom<z.output<typeof UserSchema>> }) {
  return (
    <Box>
      <Typography variant="h4">Profile</Typography>
      <Box pt={2}>
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
    </Box>
  );
}
