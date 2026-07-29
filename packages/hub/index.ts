import { createDashboardFetch } from "@enschedule/dashboard";
import { PrivateBackend } from "@enschedule/pg-driver";
import type { JobDefinition } from "@enschedule/types";
import { handleWorkerRequest } from "@enschedule/worker";
import { WorkerAPI } from "@enschedule/worker-api";
import type { ZodType } from "zod";

export interface EnscheduleOptions {
  worker:
    | (({ type: "inline" } | { type: "file"; filename: string }) & {
        accessTokenSecret?: string;
        apiKey?: string;
        refreshTokenSecret?: string;
        nafsUri?: string;
      })
    | { type: "external"; url: string; apiKey: string };
  dashboard?: boolean;
  api?: boolean;
  handlers?: JobDefinition[];
  logJobs?: boolean;
  retryStrategy?: () => number;
}

export interface EnscheduleHub {
  worker: WorkerAPI | PrivateBackend;
  fetch(request: Request): Promise<Response>;
  serve(options?: { port?: number; hostname?: string }): Bun.Server<unknown>;
  close(): Promise<void>;
}

export const createHandler = <T extends ZodType = ZodType>(
  job: JobDefinition<T>,
): JobDefinition<T> => job;

export async function enschedule(options: EnscheduleOptions): Promise<EnscheduleHub> {
  const apiKey = options.worker.apiKey ?? process.env.ENSCHEDULE_API_KEY;
  let worker: WorkerAPI | PrivateBackend;

  if (options.worker.type === "external") {
    worker = new WorkerAPI(options.worker.apiKey, options.worker.url);
  } else {
    const accessTokenSecret =
      options.worker.accessTokenSecret ?? process.env.ENSCHEDULE_ACCESS_TOKEN_SECRET;
    const refreshTokenSecret =
      options.worker.refreshTokenSecret ?? process.env.ENSCHEDULE_REFRESH_TOKEN_SECRET;
    const nafsUri = options.worker.nafsUri ?? process.env.NAFS_URI;
    if (!accessTokenSecret || !refreshTokenSecret || !nafsUri) {
      throw new Error(
        "Missing ENSCHEDULE_ACCESS_TOKEN_SECRET, ENSCHEDULE_REFRESH_TOKEN_SECRET, or NAFS_URI",
      );
    }
    const backend = new PrivateBackend({
      name: "Hub integrated worker",
      workerId: "hub-integrated-worker",
      forkArgv: options.worker.type === "file" ? [options.worker.filename] : undefined,
      inlineWorker: true,
      apiKey,
      accessTokenSecret,
      refreshTokenSecret,
      nafsUri,
    });
    backend.logJobs = options.logJobs ?? true;
    if (options.retryStrategy) backend.retryStrategy = options.retryStrategy;
    options.handlers?.forEach((handler) => backend.registerJob(handler));
    if (options.worker.type === "file") {
      const module = await import(new URL(options.worker.filename, `file://${process.cwd()}/`).href);
      const register = module.default ?? module.register;
      if (typeof register !== "function") {
        throw new Error(`${options.worker.filename} must export a default registration function`);
      }
      await register(backend);
    }
    await backend.startPolling();
    worker = backend;
  }

  const dashboardFetch = options.dashboard ? await createDashboardFetch(worker) : undefined;
  const fetch = async (request: Request) => {
    const pathname = new URL(request.url).pathname;
    if (options.api && pathname.startsWith("/api/")) {
      return handleWorkerRequest(worker, request);
    }
    if (dashboardFetch) return dashboardFetch(request);
    return new Response("Not found", { status: 404 });
  };

  return {
    worker,
    fetch,
    serve: ({ port = 3000, hostname = "0.0.0.0" } = {}) =>
      Bun.serve({ port, hostname, fetch }),
    close: async () => {
      if (worker instanceof PrivateBackend) await worker.close();
    },
  };
}
