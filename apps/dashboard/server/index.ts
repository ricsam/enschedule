import { createDocsResponse, generateOpenAPISpec } from "@richie-rpc/openapi";
import { RouteNotFoundError, ValidationError } from "@richie-rpc/server";
import { handleSpaRequest } from "@richie-router/server";
import { AuthorizationError } from "@enschedule/pg-driver";
import { enscheduleContract } from "@enschedule/types/contract";
import spaRoutes from "../shared/spa-routes.gen.json";
import { assertSameOrigin } from "./cookies";
import { createDashboardRouter } from "./session-router";
import { getWorker, type DashboardWorker } from "./worker";

const production = process.env.NODE_ENV === "production";
const clientDirectory = new URL("../dist/client/", import.meta.url).pathname;

const mime: Record<string, string> = {
  ".css": "text/css",
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript",
  ".json": "application/json",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
  ".woff2": "font/woff2",
};

function contentType(pathname: string) {
  const extension = pathname.slice(pathname.lastIndexOf("."));
  return mime[extension] ?? "application/octet-stream";
}

async function staticFile(pathname: string) {
  const clean = pathname.replace(/^\/+/, "");
  const file = Bun.file(`${clientDirectory}${clean}`);
  if (!(await file.exists())) return undefined;
  return new Response(file, {
    headers: {
      "content-type": contentType(pathname),
      "cache-control": pathname.startsWith("/assets/")
        ? "public, max-age=31536000, immutable"
        : "no-cache",
    },
  });
}

export interface DashboardFetchOptions {
  noAuth?: boolean;
  apiKey?: string;
}

function environmentFlag(value?: string) {
  return ["true", "1", "yes", "on"].includes((value ?? "").toLowerCase());
}

export async function createDashboardFetch(
  injectedWorker?: DashboardWorker,
  options: DashboardFetchOptions = {},
) {
  const worker = injectedWorker ?? await getWorker();
  const api = createDashboardRouter(worker, {
    noAuth: options.noAuth ?? environmentFlag(process.env.ENSCHEDULE_NO_AUTH),
    apiKey: options.apiKey ?? process.env.ENSCHEDULE_API_KEY,
  });
  const openapi = generateOpenAPISpec(enscheduleContract, {
    basePath: "/api",
    info: {
      title: "Enschedule API",
      version: "2.0.0",
      description: "Typed scheduling API served by Bun and Richie RPC",
    },
  });

  return async (request: Request): Promise<Response> => {
    const url = new URL(request.url);
    try {
      assertSameOrigin(request);
      if (url.pathname === "/healthz") {
        return Response.json({ message: "Endpoint is healthy", runtime: "bun" });
      }
      if (url.pathname === "/openapi.json") return Response.json(openapi);
      if (url.pathname === "/docs") return createDocsResponse("/openapi.json", { title: "Enschedule API" });
      if (url.pathname.startsWith("/api/")) return await api.fetch(request);

      if (production) {
        const asset = await staticFile(url.pathname);
        if (asset) return asset;
        const template = await Bun.file(`${clientDirectory}index.html`).text();
        const handled = await handleSpaRequest(request, {
          spaRoutesManifest: spaRoutes,
          html: { template },
          headers: { "cache-control": "no-cache" },
        });
        if (handled.matched) return handled.response;
      }
      return new Response("Not found", { status: 404 });
    } catch (error) {
      if (error instanceof Response) return error;
      if (error instanceof AuthorizationError) {
        return Response.json({ code: error.code, message: error.message }, { status: error.status });
      }
      if (error instanceof RouteNotFoundError) {
        return Response.json({ code: "NOT_FOUND", message: error.message }, { status: 404 });
      }
      if (error instanceof ValidationError) {
        return Response.json({ code: "VALIDATION_ERROR", message: error.message }, { status: 400 });
      }
      console.error(error);
      return Response.json(
        { code: "INTERNAL_ERROR", message: "Internal server error" },
        { status: 500 },
      );
    }
  };
}

export async function startDashboardServer(options: {
  port?: number;
  hostname?: string;
} = {}) {
  const fetch = await createDashboardFetch();
  const server = Bun.serve({
    port: options.port ?? Number(process.env.PORT ?? 3000),
    hostname: options.hostname ?? process.env.HOST ?? "0.0.0.0",
    fetch,
  });
  console.log(`Enschedule dashboard running at ${server.url}`);
  return server;
}
