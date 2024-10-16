import { Form, useLoaderData } from "@remix-run/react";
import { RootLayout } from "~/components/Layout";
import { TextField, Button, Box, Typography, Container } from "@mui/material";
import { accessTokenSession, refreshTokenSession } from "~/sessions";
import type {
  ActionFunctionArgs,
  LoaderFunctionArgs} from "@remix-run/node";
import {
  json,
  redirect,
} from "@remix-run/node";
import { getWorker } from "~/createWorker.server";
import { z } from "zod";
import React from "react";

export async function loader({ request }: LoaderFunctionArgs) {
  const session = await accessTokenSession.getSession(
    request.headers.get("Cookie")
  );

  if (session.has("token")) {
    // Redirect to the home page if they are already signed in.
    return redirect("/");
  }

  const data = { error: session.get("error") };

  return json(data, {
    headers: {
      "Set-Cookie": await accessTokenSession.commitSession(session),
    },
  });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const accessTokenRemixSession = await accessTokenSession.getSession(
    request.headers.get("Cookie")
  );
  const refreshTokenRemixSession = await refreshTokenSession.getSession(
    request.headers.get("Cookie")
  );

  const form = await request.formData();
  const username = z.string().parse(form.get("username"));
  const password = z.string().parse(form.get("password"));

  const tokens = await (
    await getWorker(context.worker)
  ).login(username, password);

  if (!tokens) {
    accessTokenRemixSession.flash("error", "Invalid username/password");

    // Redirect back to the login page with errors.
    return redirect("/login", {
      headers: [
        [
          "Set-Cookie",
          await accessTokenSession.commitSession(accessTokenRemixSession),
        ],
      ],
    });
  }

  accessTokenRemixSession.set("token", tokens.accessToken);
  refreshTokenRemixSession.set("token", tokens.refreshToken);

  // Login succeeded, send them to the home page.
  return redirect("/", {
    headers: [
      [
        "Set-Cookie",
        await accessTokenSession.commitSession(accessTokenRemixSession),
      ],
      [
        "Set-Cookie",
        await refreshTokenSession.commitSession(refreshTokenRemixSession),
      ],
    ],
  });
}

export default function Login() {
  const ld = useLoaderData<typeof loader>();

  const [errMessage, setErrMessage] = React.useState<string | undefined>(ld.error);
  React.useEffect(() => {
    setErrMessage(ld.error);
  }, [ld]);
  return (
    <RootLayout withoutLiveData>
      <Container maxWidth="xs">
        <Box
          display="flex"
          flexDirection="column"
          justifyContent="center"
          alignItems="flex-start"
          height="100%"
        >
          <Typography variant="h4" gutterBottom>
            Login
          </Typography>
          <Form method="post" id="login-form">
            <TextField
              label="Username"
              fullWidth
              margin="normal"
              name="username"
              error={!!errMessage}
              helperText={errMessage}
              onChange={() => setErrMessage(undefined)}
            />
            <TextField
              type="password"
              name="password"
              autoComplete="current-password"
              required
              label="Password"
              fullWidth
              margin="normal"
              error={!!errMessage}
              onChange={() => setErrMessage(undefined)}
            />
            <Button
              type="submit"
              variant="contained"
              color="primary"
              fullWidth
              sx={{ mt: 2 }}
            >
              Login
            </Button>
          </Form>
        </Box>
      </Container>
    </RootLayout>
  );
}
