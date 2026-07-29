import { Status } from "@richie-rpc/server";
import { AuthHeader } from "@enschedule/types";
import { createRouter } from "@richie-rpc/server";
import { enscheduleContract } from "@enschedule/types/contract";
import { commitSession, clearSession, getSession } from "./cookies";
import type { DashboardWorker } from "./worker";

export interface DashboardRouterOptions {
  noAuth?: boolean;
  apiKey?: string;
}

export function createDashboardRouter(
  worker: DashboardWorker,
  options: DashboardRouterOptions = {},
) {
  const noAuth = options.noAuth ?? false;
  const apiKey = options.apiKey?.replace(/^Api-Key\s+/, "").trim();
  if (noAuth && !apiKey) {
    throw new Error("ENSCHEDULE_API_KEY is required when ENSCHEDULE_NO_AUTH is enabled");
  }
  const noAuthHeader = noAuth
    ? AuthHeader.parse(`Api-Key ${apiKey}`)
    : undefined;
  const refreshes = new Map<string, ReturnType<DashboardWorker["refreshToken"]>>();
  const refreshOnce = (refreshToken: string) => {
    const active = refreshes.get(refreshToken);
    if (active) return active;
    const pending = worker.refreshToken(refreshToken);
    refreshes.set(refreshToken, pending);
    void pending.finally(() => refreshes.delete(refreshToken));
    return pending;
  };
  const expiresSoon = (accessToken?: string) => {
    if (!accessToken) return true;
    try {
      const encoded = accessToken.split(".")[1];
      if (!encoded) return true;
      const payload = JSON.parse(atob(encoded.replaceAll("-", "+").replaceAll("_", "/"))) as { exp?: number };
      return !payload.exp || payload.exp * 1000 <= Date.now() + 5_000;
    } catch {
      return true;
    }
  };
  const auth = async (request: Request) => {
    if (noAuthHeader) return { session: {}, header: noAuthHeader };
    const session = await getSession(request);
    if (session.refreshToken && expiresSoon(session.accessToken)) {
      const tokens = await refreshOnce(session.refreshToken);
      if (tokens) {
        session.accessToken = tokens.accessToken;
        session.refreshToken = tokens.refreshToken;
      } else {
        session.accessToken = undefined;
        session.refreshToken = undefined;
      }
    }
    const header = session.accessToken ? AuthHeader.parse(`Jwt ${session.accessToken}`) : undefined;
    return { session, header };
  };
  const unauthorized = () => ({
    status: Status.Unauthorized,
    body: { code: "UNAUTHORIZED", message: "Authentication required" },
  } as const);

  return createRouter(enscheduleContract, {
    health: () => ({ status: Status.OK, body: { message: "Endpoint is healthy", runtime: "bun" } }),
    login: async ({ request, body }) => {
      const tokens = await worker.login(body.username, body.password);
      if (!tokens) return unauthorized();
      const session = await getSession(request);
      session.accessToken = tokens.accessToken;
      session.refreshToken = tokens.refreshToken;
      return {
        status: Status.OK,
        body: tokens,
        headers: { "set-cookie": await commitSession(session) },
      };
    },
    refresh: async ({ request }) => {
      const session = await getSession(request);
      const tokens = session.refreshToken ? await worker.refreshToken(session.refreshToken) : undefined;
      if (!tokens) return unauthorized();
      session.accessToken = tokens.accessToken;
      session.refreshToken = tokens.refreshToken;
      return { status: Status.OK, body: tokens, headers: { "set-cookie": await commitSession(session) } };
    },
    logout: async ({ request, body }) => {
      const session = await getSession(request);
      if (session.refreshToken) await worker.logout(session.refreshToken, body.allDevices);
      return { status: Status.OK, body: { success: true }, headers: { "set-cookie": clearSession() } };
    },
    session: async ({ request }) => {
      if (noAuth) {
        return { status: Status.OK, body: { noAuth: true } };
      }
      const { session, header } = await auth(request);
      const userAuth = header ? await worker.getUserAuth(header) : undefined;
      if (header && !userAuth) {
        return { status: Status.OK, body: {}, headers: { "set-cookie": clearSession() } };
      }
      return {
        status: Status.OK,
        body: { user: userAuth?.userId ? { userId: userAuth.userId, admin: userAuth.admin } : undefined },
        headers: { "set-cookie": await commitSession(session) },
      };
    },
    userAuth: async ({ request }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      const value = await worker.getUserAuth(header);
      return value
        ? { status: Status.OK, body: value, headers: { "set-cookie": await commitSession(session) } }
        : unauthorized();
    },
    listUsers: async ({ request }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      return { status: Status.OK, body: await worker.getUsers(header), headers: { "set-cookie": await commitSession(session) } };
    },
    getUser: async ({ request, params }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      const user = await worker.getUser(header, params.id);
      return user
        ? { status: Status.OK, body: user, headers: { "set-cookie": await commitSession(session) } }
        : { status: Status.NotFound, body: { code: "NOT_FOUND", message: "User not found" } };
    },
    listWorkers: async ({ request }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      return { status: Status.OK, body: await worker.getWorkers(header), headers: { "set-cookie": await commitSession(session) } };
    },
    deleteWorkers: async ({ request, body }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      return { status: Status.OK, body: await worker.deleteWorkers(body.ids), headers: { "set-cookie": await commitSession(session) } };
    },
    listDefinitions: async ({ request }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      return { status: Status.OK, body: await worker.getLatestHandlers(header), headers: { "set-cookie": await commitSession(session) } };
    },
    getDefinition: async ({ request, params }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      try {
        return { status: Status.OK, body: await worker.getLatestHandler(params.id, header), headers: { "set-cookie": await commitSession(session) } };
      } catch {
        return { status: Status.NotFound, body: { code: "NOT_FOUND", message: "Function not found" } };
      }
    },
    listSchedules: async ({ request, query }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      return { status: Status.OK, body: await worker.getSchedules(header, query), headers: { "set-cookie": await commitSession(session) } };
    },
    createSchedule: async ({ request, body }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      return {
        status: Status.Created,
        body: await worker.scheduleJob(header, body.functionId, body.functionVersion, body.data, body.options),
        headers: { "set-cookie": await commitSession(session) },
      };
    },
    getSchedule: async ({ request, params }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      const value = await worker.getSchedule(header, params.id);
      return value
        ? { status: Status.OK, body: value, headers: { "set-cookie": await commitSession(session) } }
        : { status: Status.NotFound, body: { code: "NOT_FOUND", message: "Schedule not found" } };
    },
    updateSchedule: async ({ request, params, body }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      return { status: Status.OK, body: await worker.updateSchedule(header, { id: params.id, ...body }), headers: { "set-cookie": await commitSession(session) } };
    },
    deleteSchedule: async ({ request, params }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      return { status: Status.OK, body: await worker.deleteSchedule(header, params.id), headers: { "set-cookie": await commitSession(session) } };
    },
    scheduleActions: async ({ request, body }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      if (body.action === "run") await worker.runSchedulesNow(body.ids);
      if (body.action === "delete") await worker.deleteSchedules(body.ids);
      if (body.action === "unschedule") await worker.unschedule(body.ids);
      return { status: Status.OK, body: { success: true }, headers: { "set-cookie": await commitSession(session) } };
    },
    runSchedule: async ({ request, params }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      await worker.runScheduleNow(params.id);
      return { status: Status.OK, body: { success: true }, headers: { "set-cookie": await commitSession(session) } };
    },
    listRuns: async ({ request, query }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      return { status: Status.OK, body: await worker.getRuns({ ...query, limit: query.limit ?? 10_000, authHeader: header }), headers: { "set-cookie": await commitSession(session) } };
    },
    getRun: async ({ request, params }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      return { status: Status.OK, body: await worker.getRun(header, params.id), headers: { "set-cookie": await commitSession(session) } };
    },
    deleteRun: async ({ request, params }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      return { status: Status.OK, body: await worker.deleteRun(header, params.id), headers: { "set-cookie": await commitSession(session) } };
    },
    deleteRuns: async ({ request, body }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      return { status: Status.OK, body: await worker.deleteRuns(body.ids), headers: { "set-cookie": await commitSession(session) } };
    },
    streamLogs: async ({ request, params, stream }) => {
      const { header } = await auth(request);
      if (!header) return stream.close({ complete: false });
      const logs = await worker.streamLogs(header, params.id);
      if (!logs) return stream.close({ complete: false });
      if (logs instanceof ReadableStream) {
        const reader = logs.getReader();
        const decoder = new TextDecoder();
        let buffer = "";
        while (stream.isOpen) {
          const { done, value } = await reader.read();
          if (done) break;
          buffer += decoder.decode(value, { stream: true });
          const lines = buffer.split("\n");
          buffer = lines.pop() ?? "";
          for (const line of lines) {
            if (!line.trim()) continue;
            const message = JSON.parse(line) as { text?: string; __final__?: boolean };
            if (typeof message.text === "string") stream.send({ text: message.text });
          }
        }
        buffer += decoder.decode();
        if (buffer.trim()) {
          const message = JSON.parse(buffer) as { text?: string };
          if (typeof message.text === "string") stream.send({ text: message.text });
        }
      } else {
        for await (const chunk of logs as AsyncIterable<Uint8Array | string>) {
          if (!stream.isOpen) break;
          stream.send({ text: typeof chunk === "string" ? chunk : chunk.toString() });
        }
      }
      stream.close({ complete: true });
    },
    reset: async ({ request }) => {
      const { session, header } = await auth(request);
      if (!header) return unauthorized();
      return { status: Status.OK, body: { success: await worker.reset(header) }, headers: { "set-cookie": await commitSession(session) } };
    },
  }, { basePath: "/api" });
}
