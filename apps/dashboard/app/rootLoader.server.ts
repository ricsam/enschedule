import { type LoaderFunction } from "@remix-run/node";
import type { Theme } from "~/utils/theme-provider";
import { getThemeSession } from "~/utils/theme.server";
import { hasRefreshToken, refreshToken } from "./sessions";
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

    try {
      if (!user) {
        if (await hasRefreshToken(request)) {
          return refreshToken(request);
        }
      }
    } catch (err) {
      // ignore
    }

    return data;
  } catch (err) {
    if (await hasRefreshToken(request)) {
      return refreshToken(request);
    }
  }
  return {
    theme: themeSession.getTheme(),
  };
};
