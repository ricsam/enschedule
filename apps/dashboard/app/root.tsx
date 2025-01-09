import { Typography } from "@mui/material";
import { type LinksFunction, type MetaFunction } from "@remix-run/node";
import {
  Links,
  LiveReload,
  Meta,
  Outlet,
  Scripts,
  isRouteErrorResponse,
  useLoaderData,
  useRouteError,
} from "@remix-run/react";
import styles from "~/style/global.css";
import { MuiTheme } from "~/utils/MuiTheme";
import { ThemeProvider } from "~/utils/theme-provider";
import type { LoaderData } from "./rootLoader.server";
import { UserProvider } from "./utils/UserContext";

export const links: LinksFunction = () => {
  return [
    {
      rel: "stylesheet",
      href: styles,
    },
  ];
};

export { loader } from "./rootLoader.server";

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
        <UserProvider user={data.user}>
          <ThemeProvider specifiedTheme={data.theme}>
            <MuiTheme>
              <Outlet />
            </MuiTheme>
          </ThemeProvider>
        </UserProvider>
        {/* <ScrollRestoration /> */}
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
