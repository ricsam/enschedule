import type { AuthHeader } from "@enschedule/types";
import { createCookieSessionStorage, redirect } from "@remix-run/node";
import { z } from "zod";

type SessionFlashData = {
  error: string;
};

type SessionData = {
  token: string;
};

let httpsOnlyCookies = false;
if (process.env.HTTPS_ONLY_COOKIES && process.env.HTTPS_ONLY_COOKIES.trim()) {
  httpsOnlyCookies = true;
  if (process.env.HTTPS_ONLY_COOKIES.toLowerCase().trim() === "false") {
    httpsOnlyCookies = false;
  }
}

let sessionSecret: string[];
const parsed = z
  .array(z.string())
  .safeParse(process.env.COOKIE_SESSION_SECRET?.split(","));
if (parsed.success) {
  sessionSecret = parsed.data;
} else {
  throw new Error(
    `Invalid value for environment variable "COOKIE_SESSION_SECRET". It must be assigned a comma-separated list of strings e.g. COOKIE_SESSION_SECRET=s3cr3t,0ldS3cr3t. See remix cookie session documentation for more information.`
  );
}

const themeSession = createCookieSessionStorage({
  cookie: {
    name: "enschedule_theme",
    secure: true,
    secrets: sessionSecret,
    sameSite: "lax",
    path: "/",
    httpOnly: true,
  },
});

const accessTokenSession = createCookieSessionStorage<
  SessionData,
  SessionFlashData
>({
  cookie: {
    name: "access_token", // use any name you want here
    sameSite: "lax", // this helps with CSRF
    path: "/", // remember to add this so the cookie will work in all routes
    httpOnly: true, // for security reasons, make this cookie http only
    secrets: sessionSecret,
    secure: httpsOnlyCookies,
    maxAge: 30, // 30 seconds
  },
});

const refreshTokenSession = createCookieSessionStorage<
  SessionData,
  SessionFlashData
>({
  cookie: {
    name: "refresh_token", // use any name you want here
    sameSite: "lax", // this helps with CSRF
    path: "/refresh", // Only work on the /refresh route
    httpOnly: true, // for security reasons, make this cookie http only
    secrets: sessionSecret,
    secure: httpsOnlyCookies,
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
});

const hasRefreshTokenSession = createCookieSessionStorage<
  { hasRefreshToken: boolean },
  SessionFlashData
>({
  cookie: {
    name: "has_refresh_token", // use any name you want here
    sameSite: "lax", // this helps with CSRF
    path: "/",
    httpOnly: true, // for security reasons, make this cookie http only
    secrets: sessionSecret,
    secure: httpsOnlyCookies,
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
});

async function getRequestUrl(request: Request) {
  /**
   * e.g. run now button passes a redirect in the action, so on refresh
   * it shoudn't redirect to the request.url but to the redirect param
   */
  let requestUrlString = request.url;
  let actionRedirectPath =
    new URL(request.url).searchParams.get("postActionRedirect") ||
    request.headers.get("referrer");
  if (actionRedirectPath && typeof actionRedirectPath === "string") {
    const newRequest = new URL(request.url);
    if (actionRedirectPath.startsWith("http")) {
      requestUrlString = actionRedirectPath;
    } else {
      const parts = actionRedirectPath.split("?");
      if (parts[0]) {
        newRequest.pathname = actionRedirectPath;
      }
      if (parts[1]) {
        newRequest.search = parts[1];
      }
      if (newRequest.searchParams.has("postActionRedirect")) {
        newRequest.searchParams.delete("postActionRedirect");
      }
      requestUrlString = newRequest.toString();
      console.log("requestUrlString", requestUrlString);
    }
  }
  return requestUrlString;
}

export async function refreshToken(request: Request) {
  const requestUrl = new URL(await getRequestUrl(request));
  const refreshUrl = new URL(request.url);
  refreshUrl.pathname = "/refresh";
  refreshUrl.searchParams.set(
    "referrer",
    requestUrl.pathname + requestUrl.search
  );
  return redirect(refreshUrl.pathname + refreshUrl.search);
}

export async function getAuthHeader(
  request: Request
): Promise<z.output<typeof AuthHeader>> {
  const cookies = await getCookies(request);

  if (cookies.access.session.has("token")) {
    return `Jwt ${cookies.access.session.get("token")}`;
  }
  if (await hasRefreshToken(request)) {
    const refreshRedirect = await refreshToken(request);
    throw refreshRedirect;
  }
  const url = new URL(request.url);
  url.pathname = "/login";
  const redirectUrl = new URL(await getRequestUrl(request));
  url.search = "";
  url.searchParams.set("redirect", redirectUrl.pathname + redirectUrl.search);
  throw redirect(url.pathname + url.search);
}

export async function hasRefreshToken(request: Request) {
  const session = await hasRefreshTokenSession.getSession(
    request.headers.get("Cookie")
  );
  return Boolean(session.get("hasRefreshToken"));
}

export async function getCookies(request: Request) {
  const access = await accessTokenSession.getSession(
    request.headers.get("Cookie")
  );
  const refresh = await refreshTokenSession.getSession(
    request.headers.get("Cookie")
  );
  const hasRefresh = await hasRefreshTokenSession.getSession(
    request.headers.get("Cookie")
  );
  const theme = await themeSession.getSession(request.headers.get("Cookie"));
  return {
    access: {
      session: access,
      commit: () => accessTokenSession.commitSession(access),
    },
    refresh: {
      session: refresh,
      commit: () => refreshTokenSession.commitSession(refresh),
    },
    hasRefresh: {
      session: hasRefresh,
      commit: () => hasRefreshTokenSession.commitSession(hasRefresh),
    },
    theme: {
      session: theme,
      commit: () => themeSession.commitSession(theme),
    },
  };
}
