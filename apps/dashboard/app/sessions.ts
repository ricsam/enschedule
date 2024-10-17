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

export let sessionSecret: string[];
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

export const accessTokenSession = createCookieSessionStorage<
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
  },
});

export const refreshTokenSession = createCookieSessionStorage<
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

export const getAuthHeader = async (request: Request): Promise<string> => {
  const session = await accessTokenSession.getSession(
    request.headers.get("Cookie")
  );

  if (session.has("token")) {
    return `Jwt ${session.get("token")}`;
  }
  throw redirect("/login");
};
