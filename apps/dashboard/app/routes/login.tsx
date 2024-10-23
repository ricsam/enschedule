import { Box, Button, Container, TextField, Typography } from "@mui/material";
import type { ActionFunctionArgs, LoaderFunctionArgs } from "@remix-run/node";
import { json, redirect } from "@remix-run/node";
import { Form, useLoaderData } from "@remix-run/react";
import React from "react";
import { z } from "zod";
import { RootLayout } from "~/components/Layout";
import { getWorker } from "~/createWorker.server";
import { getCookies } from "~/sessions";

export async function loader({ request }: LoaderFunctionArgs) {
  const cookies = await getCookies(request);

  if (cookies.access.session.has("token")) {
    // Redirect to the home page if they are already signed in.
    return redirect("/");
  }

  const data = { error: cookies.access.session.get("error") };

  return json(data, {
    headers: {
      "Set-Cookie": await cookies.access.commit(),
    },
  });
}

export async function action({ request, context }: ActionFunctionArgs) {
  const cookies = await getCookies(request);

  const form = await request.formData();
  const username = z.string().parse(form.get("username"));
  const password = z.string().parse(form.get("password"));

  const tokens = await (
    await getWorker(context.worker)
  ).login(username, password);

  if (!tokens) {
    cookies.access.session.flash("error", "Invalid username/password");

    // Redirect back to the login page with errors.
    return redirect("/login", {
      headers: [["Set-Cookie", await cookies.access.commit()]],
    });
  }

  cookies.access.session.set("token", tokens.accessToken);
  cookies.refresh.session.set("token", tokens.refreshToken);
  cookies.hasRefresh.session.set("hasRefreshToken", true);

  // Login succeeded, send them to the previous page or home
  const redirectUrlParse = z
    .string()
    .refine((val) => val.startsWith("/"))
    .safeParse(new URL(request.url).searchParams.get("redirect"));
  const redirectUrl = redirectUrlParse.success ? redirectUrlParse.data : "/";
  return redirect(redirectUrl, {
    headers: [
      ["Set-Cookie", await cookies.access.commit()],
      ["Set-Cookie", await cookies.refresh.commit()],
      ["Set-Cookie", await cookies.hasRefresh.commit()],
    ],
  });
}

export default function Login() {
  const ld = useLoaderData<typeof loader>();

  const [errMessage, setErrMessage] = React.useState<string | undefined>(
    ld.error
  );
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
