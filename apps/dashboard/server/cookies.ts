import { z } from "zod";

export interface SessionCookies {
  accessToken?: string;
  refreshToken?: string;
  theme?: "light" | "dark";
}

const cookieSecrets = z
  .array(z.string().min(1))
  .min(1)
  .parse((process.env.ENSCHEDULE_COOKIE_SESSION_SECRET ?? "development-only-change-me").split(","));

const encoder = new TextEncoder();
const secure = ["true", "1", "yes"].includes(
  (process.env.ENSCHEDULE_HTTPS_ONLY_COOKIES ?? "false").toLowerCase(),
);

async function key(secret: string) {
  return crypto.subtle.importKey(
    "raw",
    encoder.encode(secret),
    { name: "HMAC", hash: "SHA-256" },
    false,
    ["sign", "verify"],
  );
}

function encode(value: string) {
  return btoa(value).replaceAll("+", "-").replaceAll("/", "_").replaceAll("=", "");
}

function decode(value: string) {
  const normalized = value.replaceAll("-", "+").replaceAll("_", "/");
  return atob(normalized.padEnd(Math.ceil(normalized.length / 4) * 4, "="));
}

async function sign(value: string) {
  const signature = await crypto.subtle.sign("HMAC", await key(cookieSecrets[0]!), encoder.encode(value));
  return `${value}.${encode(String.fromCharCode(...new Uint8Array(signature)))}`;
}

async function verify(signed: string) {
  const index = signed.lastIndexOf(".");
  if (index < 0) return undefined;
  const value = signed.slice(0, index);
  const signature = Uint8Array.from(decode(signed.slice(index + 1)), (char) => char.charCodeAt(0));
  for (const secret of cookieSecrets) {
    if (await crypto.subtle.verify("HMAC", await key(secret), signature, encoder.encode(value))) {
      return value;
    }
  }
  return undefined;
}

function parseCookieHeader(request: Request) {
  return Object.fromEntries(
    (request.headers.get("cookie") ?? "")
      .split(";")
      .map((part) => part.trim().split("="))
      .filter(([name, value]) => name && value)
      .map(([name, value]) => [decodeURIComponent(name!), decodeURIComponent(value!)]),
  );
}

export async function getSession(request: Request): Promise<SessionCookies> {
  const value = parseCookieHeader(request).enschedule_session;
  if (!value) return {};
  try {
    const payload = await verify(value);
    return payload ? JSON.parse(decode(payload)) : {};
  } catch {
    return {};
  }
}

export async function commitSession(session: SessionCookies) {
  const value = await sign(encode(JSON.stringify(session)));
  return [
    `enschedule_session=${encodeURIComponent(value)}`,
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : "",
    `Max-Age=${7 * 24 * 60 * 60}`,
  ].filter(Boolean).join("; ");
}

export function clearSession() {
  return [
    "enschedule_session=",
    "Path=/",
    "HttpOnly",
    "SameSite=Strict",
    secure ? "Secure" : "",
    "Max-Age=0",
  ].filter(Boolean).join("; ");
}

export function assertSameOrigin(request: Request) {
  if (["GET", "HEAD", "OPTIONS"].includes(request.method)) return;
  const origin = request.headers.get("origin");
  if (!origin) return;

  const requestUrl = new URL(request.url);
  const allowedOrigins = new Set([requestUrl.origin]);
  const forwardedHost = request.headers.get("x-forwarded-host")?.split(",", 1)[0]?.trim()
    ?? request.headers.get("host");
  const forwardedProtocol = request.headers.get("x-forwarded-proto")?.split(",", 1)[0]?.trim();
  if (forwardedHost) {
    allowedOrigins.add(`${forwardedProtocol || requestUrl.protocol.slice(0, -1)}://${forwardedHost}`);
  }

  for (const configuredOrigin of (process.env.ENSCHEDULE_PUBLIC_ORIGIN ?? "").split(",")) {
    if (configuredOrigin) allowedOrigins.add(configuredOrigin);
  }

  if (!allowedOrigins.has(origin)) {
    throw new Response("Cross-origin mutation rejected", { status: 403 });
  }
}
