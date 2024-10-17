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

export async function refreshToken(request: Request) {
  const requestUrl = new URL(request.url);
  const refreshUrl = new URL(request.url);
  refreshUrl.pathname = "/refresh";
  refreshUrl.searchParams.set("referrer", requestUrl.pathname);
  return redirect(refreshUrl.toString());
}

export async function getAuthHeader(request: Request): Promise<string> {
  const cookies = await getCookies(request);

  if (cookies.access.session.has("token")) {
    return `Jwt ${cookies.access.session.get("token")}`;
  }
  if (await hasRefreshToken(request)) {
    const refreshRedirect = await refreshToken(request);
    throw refreshRedirect;
  }
  throw redirect("/login");
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
