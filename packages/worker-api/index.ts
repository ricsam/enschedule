import { createClient, type Client } from "@richie-rpc/client";
import type {
  AuthHeader,
  ListRunsOptions,
  Group,
  PublicJobDefinition,
  PublicJobRun,
  PublicJobSchedule,
  PublicWorker,
  ScheduleJobOptions,
  ScheduleJobResult,
  ScheduleUpdatePayloadSchema,
  SchedulesFilterSchema,
  UserSchema,
  UserAuthSchema,
} from "@enschedule/types";
import {
  API_BASE_PATH,
  enscheduleContract,
  type EnscheduleContract,
} from "@enschedule/types/contract";
import type { z } from "zod";

export class NetworkError extends Error {
  originalError?: Error;
  cliMessage?: string;

  constructor(message: string) {
    super(message);
    this.name = "NetworkError";
  }
}

type Auth = z.output<typeof AuthHeader>;
type WorkerClient = Client<EnscheduleContract>;

export class WorkerAPI {
  readonly client: WorkerClient;
  private readonly apiKey: string;
  private readonly apiUrl: string;

  constructor(apiKey: string, url: string) {
    this.apiKey = apiKey.replace(/^Api-Key\s+/, "");
    this.apiUrl = `${url.replace(/\/$/, "")}${API_BASE_PATH}`;
    this.client = createClient(enscheduleContract, {
      baseUrl: this.apiUrl,
      headers: () => ({ "x-api-key": this.apiKey }),
    });
  }

  private headers(authHeader?: Auth) {
    return authHeader ? { authorization: authHeader } : { "x-api-key": this.apiKey };
  }

  private requestHeaders(authHeader?: Auth): HeadersInit {
    return authHeader
      ? { authorization: authHeader }
      : { "x-api-key": this.apiKey };
  }

  async getGroups(authHeader: Auth): Promise<Group[]> {
    return (await this.client.listGroups({ headers: this.headers(authHeader) })).payload;
  }

  async createGroup(authHeader: Auth, body: { key: string; title: string; description?: string; memberIds: number[] }): Promise<Group> {
    return (await this.client.createGroup({ headers: this.headers(authHeader), body })).payload;
  }

  async updateGroup(authHeader: Auth, id: number, body: { title?: string; description?: string; memberIds?: number[] }): Promise<Group> {
    return (await this.client.updateGroup({ headers: this.headers(authHeader), params: { id }, body })).payload;
  }

  async deleteGroup(authHeader: Auth, id: number): Promise<Group> {
    return (await this.client.deleteGroup({ headers: this.headers(authHeader), params: { id } })).payload;
  }

  async getAccessDiagnostics(authHeader: Auth) {
    return (await this.client.accessDiagnostics({ headers: this.headers(authHeader) })).payload;
  }

  async getLatestHandlers(authHeader: Auth): Promise<PublicJobDefinition[]> {
    return (await this.client.listDefinitions({ headers: this.headers(authHeader) })).payload;
  }

  async getLatestHandler(id: string, authHeader: Auth): Promise<PublicJobDefinition> {
    return (
      await this.client.getDefinition({
        params: { id },
        headers: this.headers(authHeader),
      })
    ).payload;
  }

  async getSchedules(
    authHeader: Auth,
    filter: z.output<typeof SchedulesFilterSchema> = {},
  ): Promise<PublicJobSchedule[]> {
    return (
      await this.client.listSchedules({
        headers: this.headers(authHeader),
        query: filter,
      })
    ).payload;
  }

  async scheduleJob(
    authHeader: Auth,
    functionId: string,
    functionVersion: number,
    data: unknown,
    options: ScheduleJobOptions,
  ): Promise<ScheduleJobResult> {
    return (
      await this.client.createSchedule({
        headers: this.headers(authHeader),
        body: { functionId, functionVersion, data, options },
      })
    ).payload;
  }

  async getSchedule(authHeader: Auth, id: number): Promise<PublicJobSchedule> {
    return (
      await this.client.getSchedule({
        params: { id },
        headers: this.headers(authHeader),
      })
    ).payload;
  }

  async updateSchedule(
    authHeader: Auth,
    payload: z.output<typeof ScheduleUpdatePayloadSchema>,
  ): Promise<PublicJobSchedule> {
    const { id, ...body } = payload;
    return (
      await this.client.updateSchedule({
        params: { id },
        headers: this.headers(authHeader),
        body,
      })
    ).payload;
  }

  async deleteSchedule(authHeader: Auth, id: number): Promise<PublicJobSchedule> {
    return (
      await this.client.deleteSchedule({
        params: { id },
        headers: this.headers(authHeader),
      })
    ).payload;
  }

  async deleteSchedules(authHeader: Auth, ids: number[]): Promise<number[]> {
    await this.client.scheduleActions({
      headers: this.headers(authHeader),
      body: { ids, action: "delete" },
    });
    return ids;
  }

  async runScheduleNow(authHeader: Auth, id: number): Promise<void> {
    await this.client.runSchedule({ params: { id }, headers: this.headers(authHeader) });
  }

  async runSchedulesNow(authHeader: Auth, ids: number[]): Promise<void> {
    await this.client.scheduleActions({
      headers: this.headers(authHeader),
      body: { ids, action: "run" },
    });
  }

  async unschedule(authHeader: Auth, ids: number[]): Promise<void> {
    await this.client.scheduleActions({
      headers: this.headers(authHeader),
      body: { ids, action: "unschedule" },
    });
  }

  async getWorkers(authHeader: Auth): Promise<PublicWorker[]> {
    return (await this.client.listWorkers({ headers: this.headers(authHeader) })).payload;
  }

  async deleteWorkers(authHeader: Auth, ids: number[]): Promise<number[]> {
    return (
      await this.client.deleteWorkers({
        headers: this.headers(authHeader),
        body: { ids },
      })
    ).payload;
  }

  async getRuns(options: ListRunsOptions): Promise<{ count: number; rows: PublicJobRun[] }> {
    const query = {
      scheduleId: options.scheduleId,
      order: options.order,
      limit: options.limit ?? 10_000,
      offset: options.offset,
    };
    return (
      await this.client.listRuns({
        headers: this.headers(options.authHeader),
        query,
      })
    ).payload;
  }

  async getRun(authHeader: Auth, id: number): Promise<PublicJobRun> {
    return (
      await this.client.getRun({
        params: { id },
        headers: this.headers(authHeader),
      })
    ).payload;
  }

  async deleteRun(authHeader: Auth, id: number): Promise<PublicJobRun> {
    return (
      await this.client.deleteRun({
        params: { id },
        headers: this.headers(authHeader),
      })
    ).payload;
  }

  async deleteRuns(authHeader: Auth, ids: number[]): Promise<number[]> {
    return (
      await this.client.deleteRuns({
        headers: this.headers(authHeader),
        body: { ids },
      })
    ).payload;
  }

  async reset(authHeader: Auth): Promise<boolean> {
    return (await this.client.reset({ headers: this.headers(authHeader) })).payload.success;
  }

  async login(username: string, password: string) {
    try {
      return (await this.client.login({ body: { username, password } })).payload;
    } catch {
      return undefined;
    }
  }

  async refreshToken(refreshToken: string) {
    try {
      return (await this.client.refresh({ body: { refreshToken } })).payload;
    } catch {
      return undefined;
    }
  }

  async logout(refreshToken: string, allDevices: boolean): Promise<void> {
    await this.client.logout({ body: { refreshToken, allDevices } });
  }

  async getUser(
    authHeader: Auth,
    id: number,
  ): Promise<z.output<typeof UserSchema> | undefined> {
    try {
      return (
        await this.client.getUser({
          params: { id },
          headers: this.headers(authHeader),
        })
      ).payload;
    } catch {
      return undefined;
    }
  }

  async getUsers(authHeader: Auth): Promise<z.output<typeof UserSchema>[]> {
    return (await this.client.listUsers({ headers: this.headers(authHeader) })).payload;
  }

  async getUserAuth(
    authHeader: Auth,
  ): Promise<z.output<typeof UserAuthSchema> | undefined> {
    try {
      return (await this.client.userAuth({ headers: this.headers(authHeader) })).payload;
    } catch {
      return undefined;
    }
  }

  async streamLogs(authHeader: Auth, runId: number): Promise<ReadableStream<Uint8Array> | undefined> {
    try {
      // Keep the worker's NDJSON response intact. Attaching listeners only after
      // the Richie streaming client promise resolves can lose fast log chunks.
      const response = await fetch(`${this.apiUrl}/runs/${runId}/logs`, {
        method: "POST",
        headers: this.requestHeaders(authHeader),
      });
      return response.ok && response.body ? response.body : undefined;
    } catch {
      return undefined;
    }
  }
}
