import { createCookieSessionStorage } from "@remix-run/node";

type SessionFlashData = {
  error: string;
};

type SessionData = {
  token: string;
};

export const accessTokenSession = createCookieSessionStorage<
  SessionData,
  SessionFlashData
>({
  cookie: {
    name: "access_token", // use any name you want here
    sameSite: "lax", // this helps with CSRF
    path: "/", // remember to add this so the cookie will work in all routes
    httpOnly: true, // for security reasons, make this cookie http only
    secrets: ["s3cr3t"], // replace this with an actual secret
    secure: process.env.NODE_ENV === "production", // enable this in prod only
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
    secrets: ["s3cr3t"], // replace this with an actual secret
    secure: process.env.NODE_ENV === "production", // enable this in prod only
    maxAge: 60 * 60 * 24 * 7, // 1 week
  },
});
