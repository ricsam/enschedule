import { createRouter, RouteNotFoundError, Status, ValidationError } from "@richie-rpc/server";
import type { PrivateBackend } from "@enschedule/pg-driver";
import type { WorkerAPI } from "@enschedule/worker-api";
import { AuthHeader } from "@enschedule/types";
import { API_BASE_PATH, enscheduleContract } from "@enschedule/types/contract";
import { z } from "zod";

export type WorkerBackend = PrivateBackend | WorkerAPI;

const unauthorized = () => ({
  status: Status.Unauthorized,
  body: { code: "UNAUTHORIZED", message: "Authentication required" },
} as const);

const notFound = (message: string) => ({
  status: Status.NotFound,
  body: { code: "NOT_FOUND", message },
} as const);

function getAuthHeader(
  headers: { authorization?: string; "x-api-key"?: string },
): z.output<typeof AuthHeader> | undefined {
  const authorization = AuthHeader.safeParse(headers.authorization);
  if (authorization.success) return authorization.data;
  if (headers["x-api-key"]) return `Api-Key ${headers["x-api-key"]}`;
  return undefined;
}

export function createWorkerRouter(worker: WorkerBackend) {
  const requireAuth = async (headers: {
    authorization?: string;
    "x-api-key"?: string;
  }) => {
    const authHeader = getAuthHeader(headers);
    if (!authHeader) return undefined;
    const user = await worker.getUserAuth(authHeader);
    return user ? authHeader : undefined;
  };

  return createRouter(
    enscheduleContract,
    {
      health: () => ({
        status: Status.OK,
        body: { message: "Endpoint is healthy", runtime: "bun" },
      }),
      login: async ({ body }) => {
        const tokens = await worker.login(body.username, body.password);
        return tokens
          ? { status: Status.OK, body: tokens }
          : unauthorized();
      },
      refresh: async ({ body }) => {
        const tokens = await worker.refreshToken(body.refreshToken);
        return tokens
          ? { status: Status.OK, body: tokens }
          : unauthorized();
      },
      logout: async ({ body }) => {
        await worker.logout(body.refreshToken, body.allDevices);
        return { status: Status.OK, body: { success: true } };
      },
      session: async ({ headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return { status: Status.OK, body: {} };
        const auth = await worker.getUserAuth(authHeader);
        return {
          status: Status.OK,
          body: {
            user: auth?.userId
              ? { userId: auth.userId, admin: auth.admin }
              : undefined,
          },
        };
      },
      userAuth: async ({ headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        const user = await worker.getUserAuth(authHeader);
        return user
          ? { status: Status.OK, body: user }
          : unauthorized();
      },
      listUsers: async ({ headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        return { status: Status.OK, body: await worker.getUsers(authHeader) };
      },
      getUser: async ({ params, headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        const user = await worker.getUser(authHeader, params.id);
        return user
          ? { status: Status.OK, body: user }
          : notFound("User not found");
      },
      listWorkers: async ({ headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        return { status: Status.OK, body: await worker.getWorkers(authHeader) };
      },
      deleteWorkers: async ({ body, headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        return { status: Status.OK, body: await worker.deleteWorkers(body.ids) };
      },
      listDefinitions: async ({ headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        return {
          status: Status.OK,
          body: await worker.getLatestHandlers(authHeader),
        };
      },
      getDefinition: async ({ params, headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        try {
          return {
            status: Status.OK,
            body: await worker.getLatestHandler(params.id, authHeader),
          };
        } catch {
          return notFound("Function not found");
        }
      },
      listSchedules: async ({ query, headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        return {
          status: Status.OK,
          body: await worker.getSchedules(authHeader, query),
        };
      },
      createSchedule: async ({ body, headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        return {
          status: Status.Created,
          body: await worker.scheduleJob(
            authHeader,
            body.functionId,
            body.functionVersion,
            body.data,
            body.options,
          ),
        };
      },
      getSchedule: async ({ params, headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        const schedule = await worker.getSchedule(authHeader, params.id);
        return schedule
          ? { status: Status.OK, body: schedule }
          : notFound("Schedule not found");
      },
      updateSchedule: async ({ params, body, headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        return {
          status: Status.OK,
          body: await worker.updateSchedule(authHeader, { id: params.id, ...body }),
        };
      },
      deleteSchedule: async ({ params, headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        return {
          status: Status.OK,
          body: await worker.deleteSchedule(authHeader, params.id),
        };
      },
      scheduleActions: async ({ body, headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        if (body.action === "run") await worker.runSchedulesNow(body.ids);
        if (body.action === "unschedule") await worker.unschedule(body.ids);
        if (body.action === "delete") await worker.deleteSchedules(body.ids);
        return { status: Status.OK, body: { success: true } };
      },
      runSchedule: async ({ params, headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        await worker.runScheduleNow(params.id);
        return { status: Status.OK, body: { success: true } };
      },
      listRuns: async ({ query, headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        return {
          status: Status.OK,
          body: await worker.getRuns({ ...query, authHeader }),
        };
      },
      getRun: async ({ params, headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        try {
          return {
            status: Status.OK,
            body: await worker.getRun(authHeader, params.id),
          };
        } catch {
          return notFound("Run not found");
        }
      },
      deleteRun: async ({ params, headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        return {
          status: Status.OK,
          body: await worker.deleteRun(authHeader, params.id),
        };
      },
      deleteRuns: async ({ body, headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        return { status: Status.OK, body: await worker.deleteRuns(body.ids) };
      },
      streamLogs: async ({ params, headers, stream }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) {
          stream.close({ complete: false });
          return;
        }
        const logs = await worker.streamLogs(authHeader, params.id);
        if (!logs) {
          stream.close({ complete: false });
          return;
        }
        if (logs instanceof ReadableStream) {
          const reader = logs.getReader();
          const decoder = new TextDecoder();
          while (stream.isOpen) {
            const { done, value } = await reader.read();
            if (done) break;
            stream.send({ text: decoder.decode(value, { stream: true }) });
          }
        } else {
          for await (const chunk of logs as AsyncIterable<Uint8Array | string>) {
            if (!stream.isOpen) break;
            stream.send({ text: typeof chunk === "string" ? chunk : chunk.toString() });
          }
        }
        stream.close({ complete: true });
      },
      reset: async ({ headers }) => {
        const authHeader = await requireAuth(headers);
        if (!authHeader) return unauthorized();
        return {
          status: Status.OK,
          body: { success: await worker.reset(authHeader) },
        };
      },
    },
    { basePath: API_BASE_PATH },
  );
}

export async function handleWorkerRequest(
  worker: WorkerBackend,
  request: Request,
): Promise<Response> {
  try {
    return await createWorkerRouter(worker).fetch(request);
  } catch (error) {
    if (error instanceof RouteNotFoundError) {
      return Response.json(
        { code: "NOT_FOUND", message: error.message },
        { status: Status.NotFound },
      );
    }
    if (error instanceof ValidationError) {
      return Response.json(
        { code: "VALIDATION_ERROR", message: error.message },
        { status: Status.BadRequest },
      );
    }
    console.error(error);
    return Response.json(
      { code: "INTERNAL_ERROR", message: "Internal server error" },
      { status: Status.InternalServerError },
    );
  }
}

export interface ServeOptions {
  port: number;
  hostname?: string;
}

export function serveWorker(worker: WorkerBackend, options: ServeOptions) {
  const server = Bun.serve({
    port: options.port,
    hostname: options.hostname ?? "0.0.0.0",
    fetch: (request) => handleWorkerRequest(worker, request),
  });
  console.log(`Worker API is running on ${server.url}`);
  return server;
}
