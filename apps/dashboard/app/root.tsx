import { Typography } from "@mui/material";
import type {
  LinksFunction,
  LoaderFunction,
  MetaFunction,
} from "@remix-run/node";
import {
  isRouteErrorResponse,
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  ScrollRestoration,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import styles from "~/style/global.css";
import { MuiTheme } from "~/utils/MuiTheme";
import type { Theme } from "~/utils/theme-provider";
import { ThemeProvider } from "~/utils/theme-provider";
import { getThemeSession } from "~/utils/theme.server";

export type LoaderData = {
  theme: Theme | null;
};

export const links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: styles,
    },
  ];
};

export const loader: LoaderFunction = async ({ request }) => {
  const themeSession = await getThemeSession(request);

  const data: LoaderData = {
    theme: themeSession.getTheme(),
  };

  return data;
};

export const meta: MetaFunction = () => [
  { charset: "utf-8" },
  { title: "Enschedule" },
  { viewport: "width=device-width,initial-scale=1" },
];

export default function App() {
  const data = useLoaderData<LoaderData>();

  return (
    <html lang="en">
      <head>
        <Meta />
        <Links />
      </head>
      <body>
        <ThemeProvider specifiedTheme={data.theme}>
          <MuiTheme>
            <Outlet />
          </MuiTheme>
        </ThemeProvider>
        <ScrollRestoration />
        <Scripts />
        <LiveReload />
      </body>
    </html>
  );
}

export function ErrorBoundary({ error }: { error: Error }) {
  console.error(error);
  return (
    <html>
      <head>
        <title>Oh no!</title>
        <Meta />
        <Links />
      </head>
      <body>
        <Typography fontSize={60}>😪</Typography>
        <Scripts />
      </body>
    </html>
  );
}

export function CatchBoundary() {
  const error = useRouteError();
  let errorNode: React.ReactNode = null;
  if (isRouteErrorResponse(error)) {
    errorNode = (
      <div>
        <h1>Oops</h1>
        <p>Status: {error.status}</p>
        <p>{error.data.message}</p>
      </div>
    );
  } else {
    errorNode = String(error);
  }

  return (
    <html>
      <head>
        <title>Oh no!</title>
        <Meta />
        <Links />
      </head>
      <body>
        <Typography fontSize={60}>😪</Typography>
        <div className="error-container">
          <h1>{errorNode}</h1>
        </div>
        <Scripts />
      </body>
    </html>
  );
}
