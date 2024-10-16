import { redirect, type LoaderFunction } from "@remix-run/node";
import { TokenExpiredError } from "jsonwebtoken";
import type { Theme } from "~/utils/theme-provider";
import { getThemeSession } from "~/utils/theme.server";
import type { User } from "./types";
import { authenticate } from "./utils/user.server";
export type LoaderData = {
  theme?: Theme;
  user?: User;
};
export const loader: LoaderFunction = async ({ request }) => {
  const themeSession = await getThemeSession(request);
  const requestUrl = new URL(request.url);

  if (requestUrl.pathname === "/refresh") {
    return {
      theme: themeSession.getTheme(),
    };
  }

  try {
    const user = await authenticate(request);
    const data: LoaderData = {
      theme: themeSession.getTheme(),
      user,
    };

    return data;
  } catch (err) {
    if (err instanceof TokenExpiredError) {
      const refreshUrl = new URL(request.url);
      refreshUrl.pathname = "/refresh";
      refreshUrl.searchParams.set("referrer", requestUrl.pathname);
      return redirect(refreshUrl.toString());
    }
  }
};
