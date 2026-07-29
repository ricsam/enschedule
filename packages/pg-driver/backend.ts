import crypto from "node:crypto";
import os from "node:os";
import type { Readable } from "node:stream";
import { nafs } from "nafs";
import * as jwt from "jsonwebtoken";
import { CronExpressionParser } from "cron-parser";
import {
  and,
  asc,
  desc,
  eq,
  inArray,
  isNull,
  lte,
  or,
  sql,
} from "drizzle-orm";
import type {
  AuthHeader,
  FunctionAccess,
  JobDefinition,
  ListRunsOptions,
  PublicJobDefinition,
  PublicJobRun,
  PublicJobSchedule,
  PublicWorker,
  RunAccess,
  RunHandlerInCp,
  ScheduleAccess,
  ScheduleJobOptions,
  ScheduleJobResult,
  ScheduleUpdatePayloadSchema,
  SchedulesFilterSchema,
  UserAuthSchema,
  UserSchema,
  WorkerAccess,
} from "@enschedule/types";
import {
  JobDefinitionSchema,
  RunStatus,
  ScheduleStatus,
  WorkerStatus,
} from "@enschedule/types";
import type { ZodType } from "zod";
import { z } from "zod";
import { createDatabase, type DatabaseHandle, type DatabaseOptions } from "./database";
import { migrateDatabase as runMigrations } from "./migrate";
import {
  apiKeys,
  enscheduleMeta,
  groups,
  runGroupDeleteAccess,
  runGroupViewAccess,
  runGroupViewLogsAccess,
  runs,
  runUserDeleteAccess,
  runUserViewAccess,
  runUserViewLogsAccess,
  schedules,
  sessions,
  userGroupAssociation,
  users,
  workers,
} from "./schema";

const DRIVER_VERSION = 2;
const PACKAGE_VERSION = "2.0.0";

type Auth = z.output<typeof AuthHeader>;
type UserAuth = z.output<typeof UserAuthSchema>;
type DbWorker = typeof workers.$inferSelect;
type DbSchedule = typeof schedules.$inferSelect;
type DbRun = typeof runs.$inferSelect;
type DbUser = typeof users.$inferSelect;

export interface BackendOptions {
  workerId: string;
  name: string;
  description?: string;
  database?: DatabaseOptions;
  forkArgv?: string[];
  inlineWorker?: boolean;
  defaultFunctionAccess?: FunctionAccess;
  defaultScheduleAccess?: ScheduleAccess;
  defaultRunAccess?: RunAccess;
  accessTokenSecret: string;
  refreshTokenSecret: string;
  nafsUri: string;
  apiKey?: string;
}

interface WorkerInstance {
  workerId: string;
  title: string;
  description?: string;
  instanceId: string;
}

interface Access {
  users?: number[];
  groups?: number[];
}

type CreateJobScheduleOptions = Partial<ScheduleJobOptions>;

interface RunRecord extends DbRun {
  worker?: DbWorker | null;
}

interface ScheduleRecord extends DbSchedule {
  lastRun?: RunRecord | null;
}

const shortHash = (value: string) =>
  crypto.createHash("sha256").update(value).digest("hex").slice(0, 8);

const createPublicUser = (user: DbUser): z.output<typeof UserSchema> => ({
  id: user.id,
  username: user.username,
  name: user.name,
  email: user.email ?? undefined,
  admin: user.admin,
  createdAt: user.createdAt,
});

const runStatus = (run: RunRecord): RunStatus => {
  if (run.finishedAt) return run.exitSignal === "0" ? RunStatus.SUCCESS : RunStatus.FAILED;
  if (!run.worker || workerStatus(run.worker) === WorkerStatus.DOWN) return RunStatus.LOST;
  return RunStatus.RUNNING;
};

const workerStatus = (worker: DbWorker): WorkerStatus => {
  const elapsed = Date.now() - worker.lastReached.getTime();
  if (elapsed > worker.pollInterval * 2000 + 5000) return WorkerStatus.DOWN;
  if (elapsed > worker.pollInterval * 1000 + 5000) return WorkerStatus.PENDING;
  return WorkerStatus.UP;
};

const serializeRun = (run: RunRecord) => ({
  id: run.id,
  createdAt: run.createdAt,
  exitSignal: run.exitSignal ?? undefined,
  finishedAt: run.finishedAt ?? undefined,
  startedAt: run.startedAt,
  scheduledToRunAt: run.scheduledToRunAt,
  data: run.data ?? undefined,
  status: runStatus(run),
});

function workerHash(worker: Pick<DbWorker, "title" | "description" | "pollInterval" | "definitions" | "defaultFunctionAccess" | "defaultScheduleAccess" | "defaultRunAccess">) {
  return shortHash(JSON.stringify({
    title: worker.title,
    description: worker.description,
    pollInterval: worker.pollInterval,
    definitions: [...worker.definitions].sort((a, b) => a.id.localeCompare(b.id)),
    defaultFunctionAccess: worker.defaultFunctionAccess,
    defaultScheduleAccess: worker.defaultScheduleAccess,
    defaultRunAccess: worker.defaultRunAccess,
  }));
}

const publicWorker = (worker: DbWorker, workerRuns: DbRun[] = []): PublicWorker => ({
  id: worker.id,
  workerId: worker.workerId,
  version: worker.version,
  pollInterval: worker.pollInterval,
  title: worker.title,
  description: worker.description ?? undefined,
  definitions: worker.definitions,
  instanceId: worker.instanceId,
  createdAt: worker.createdAt,
  hostname: worker.hostname,
  lastReached: worker.lastReached,
  runs: workerRuns.map((run) => serializeRun({ ...run, worker })),
  lastRun: worker.lastRunId && workerRuns.some((run) => run.id === worker.lastRunId)
    ? serializeRun({ ...workerRuns.find((run) => run.id === worker.lastRunId)!, worker })
    : undefined,
  status: workerStatus(worker),
  versionHash: workerHash(worker),
  defaultFunctionAccess: worker.defaultFunctionAccess ?? undefined,
  defaultScheduleAccess: worker.defaultScheduleAccess ?? undefined,
  defaultRunAccess: worker.defaultRunAccess ?? undefined,
  access: worker.access ?? undefined,
});

const scheduleStatus = (schedule: ScheduleRecord, hasFunction: boolean): ScheduleStatus => {
  let status = ScheduleStatus.UNSCHEDULED;
  if (schedule.runAt || schedule.runNow) status = hasFunction ? ScheduleStatus.SCHEDULED : ScheduleStatus.NO_WORKER;
  if (schedule.lastRun) {
    const statusOfRun = runStatus(schedule.lastRun);
    if (statusOfRun === RunStatus.RUNNING) return ScheduleStatus.RUNNING;
    if (statusOfRun === RunStatus.LOST || statusOfRun === RunStatus.FAILED) {
      if (
        schedule.retryFailedJobs &&
        schedule.runAt &&
        (schedule.maxRetries === -1 || schedule.retries < schedule.maxRetries)
      ) return ScheduleStatus.RETRYING;
      return ScheduleStatus.FAILED;
    }
    if (schedule.runNow) return ScheduleStatus.SCHEDULED;
    return ScheduleStatus.SUCCESS;
  }
  return status;
};

const publicSchedule = (
  schedule: ScheduleRecord,
  definition: PublicJobDefinition | string,
): PublicJobSchedule => ({
  id: schedule.id,
  title: schedule.title,
  description: schedule.description ?? undefined,
  retryFailedJobs: schedule.retryFailedJobs,
  retries: schedule.retries,
  maxRetries: schedule.maxRetries,
  runAt: schedule.runAt ?? undefined,
  runNow: schedule.runNow,
  cronExpression: schedule.cronExpression ?? undefined,
  lastRun: schedule.lastRun ? serializeRun(schedule.lastRun) : undefined,
  functionId: schedule.functionId,
  createdAt: schedule.createdAt,
  jobDefinition: definition,
  numRuns: schedule.numRuns,
  data: schedule.data ?? undefined,
  status: scheduleStatus(schedule, typeof definition !== "string"),
  eventId: schedule.eventId ?? undefined,
  defaultRunAccess: schedule.defaultRunAccess ?? undefined,
});

export const createPublicJobDefinition = (job: JobDefinition): PublicJobDefinition => {
  const jsonSchema = job.dataSchema
    ? (z.toJSONSchema(job.dataSchema, { unrepresentable: "any" }) as Record<string, unknown>)
    : undefined;
  return {
    id: job.id,
    version: job.version,
    title: job.title,
    description: job.description,
    example: job.example,
    codeBlock: jsonSchema ? JSON.stringify(jsonSchema, null, 2) : undefined,
    jsonSchema,
    access: job.access,
    defaultScheduleAccess: job.defaultScheduleAccess,
    defaultRunAccess: job.defaultRunAccess,
  };
};

export class PrivateBackend {
  public pollInterval = 5;
  public logJobs = false;
  protected maxJobsPerTick = 4;
  protected readonly database: DatabaseHandle;
  protected workerInstance: WorkerInstance;
  protected registeredWorker?: DbWorker;
  protected inlineWorker: boolean;
  private readonly accessTokenSecret: string;
  private readonly refreshTokenSecret: string;
  private readonly nafsUri: string;
  private readonly apiKey?: string;
  private readonly defaultFunctionAccess?: FunctionAccess;
  private readonly defaultScheduleAccess?: ScheduleAccess;
  private readonly defaultRunAccess?: RunAccess;
  private readonly forkArgv?: string[];
  protected definedJobs: Record<string, Record<string, JobDefinition> | undefined> = {};
  private handlerMigrations: Record<string, Record<string, { targetVersion: number; migrateFn: (data: unknown) => unknown }> | undefined> = {};
  private nafsInstance?: Awaited<ReturnType<typeof nafs>>;
  private pollingStartTimerId?: ReturnType<typeof setTimeout>;
  private pollingIntervalId?: ReturnType<typeof setInterval>;
  public isPolling = false;

  constructor(options: BackendOptions) {
    this.database = createDatabase(options.database);
    this.workerInstance = {
      workerId: options.workerId,
      title: options.name,
      description: options.description,
      instanceId: shortHash(crypto.randomUUID()),
    };
    this.inlineWorker = options.inlineWorker ?? false;
    this.accessTokenSecret = options.accessTokenSecret;
    this.refreshTokenSecret = options.refreshTokenSecret;
    this.nafsUri = options.nafsUri;
    this.apiKey = options.apiKey;
    this.defaultFunctionAccess = options.defaultFunctionAccess;
    this.defaultScheduleAccess = options.defaultScheduleAccess;
    this.defaultRunAccess = options.defaultRunAccess;
    this.forkArgv = options.forkArgv;
  }

  async close() {
    this.stopPolling();
    await this.database.close();
  }

  private async scheduleRecord(id: number): Promise<ScheduleRecord | undefined> {
    const schedule = await this.database.db.query.schedules.findFirst({
      where: eq(schedules.id, id),
      with: { lastRun: { with: { worker: true } } },
    });
    return schedule as ScheduleRecord | undefined;
  }

  private async runRecord(id: number): Promise<RunRecord | undefined> {
    const run = await this.database.db.query.runs.findFirst({
      where: eq(runs.id, id),
      with: { worker: true },
    });
    return run as RunRecord | undefined;
  }

  private async auth(authHeader: Auth): Promise<UserAuth | undefined> {
    const [type, token] = authHeader.split(" ", 2);
    if (type === "Api-Key" && token === this.apiKey) return { admin: true, groups: [] };
    if (type === "Jwt") {
      try {
        const decoded = jwt.verify(token, this.accessTokenSecret) as { userId: number };
        const user = await this.database.db.query.users.findFirst({
          where: eq(users.id, decoded.userId),
          with: { groups: true },
        });
        if (!user) return undefined;
        return {
          userId: user.id,
          admin: user.admin,
          groups: user.groups.map(({ groupId }) => groupId),
        };
      } catch {
        return undefined;
      }
    }
    if (type === "User-Api-Key") {
      const key = await this.database.db.query.apiKeys.findFirst({
        where: eq(apiKeys.key, token),
      });
      if (!key || (key.expiresAt && key.expiresAt < new Date())) return undefined;
      const user = await this.database.db.query.users.findFirst({
        where: eq(users.id, key.userId),
        with: { groups: true },
      });
      if (!user) return undefined;
      return {
        userId: user.id,
        admin: user.admin,
        groups: user.groups.map(({ groupId }) => groupId),
      };
    }
    return undefined;
  }

  async getUserAuth(authHeader: Auth) {
    return this.auth(authHeader);
  }

  private canView(user: UserAuth, access?: Access) {
    if (user.admin) return true;
    if (user.userId && access?.users?.includes(user.userId)) return true;
    return access?.groups?.some((id) => user.groups.includes(id)) ?? false;
  }

  private definition(functionId: string, version: number, availableWorkers: PublicWorker[]) {
    const local = this.definedJobs[functionId]?.[String(version)];
    if (local) return createPublicJobDefinition(local);
    for (const worker of availableWorkers.sort((a) => (a.status === WorkerStatus.UP ? -1 : 1))) {
      const found = worker.definitions.find((entry) => entry.id === functionId && entry.version === version);
      if (found) return found;
    }
    return `${functionId} v${version}`;
  }

  public registerJob<T extends ZodType = ZodType>(job: JobDefinition<T>) {
    JobDefinitionSchema.parse(job);
    const versions = this.definedJobs[job.id] ?? {};
    job.access = this.mergeAccess(this.defaultFunctionAccess, job.access, ["view", "createSchedule"]);
    job.defaultScheduleAccess = this.mergeAccess(
      this.defaultScheduleAccess,
      job.defaultScheduleAccess,
      ["view", "edit", "delete"],
    );
    job.defaultRunAccess = this.mergeAccess(this.defaultRunAccess, job.defaultRunAccess, ["view", "viewLogs", "delete"]);
    versions[String(job.version)] = job as JobDefinition;
    this.definedJobs[job.id] = versions;
    return job;
  }

  private mergeAccess<T extends Record<string, Access | undefined>>(
    parent: T | undefined,
    child: T | undefined,
    keys: string[],
  ): T | undefined {
    const result: Record<string, Access> = {};
    for (const key of keys) {
      const users = [...new Set([...(parent?.[key]?.users ?? []), ...(child?.[key]?.users ?? [])])];
      const groupsList = [...new Set([...(parent?.[key]?.groups ?? []), ...(child?.[key]?.groups ?? [])])];
      if (users.length || groupsList.length) {
        result[key] = {
          users: users.length ? users : undefined,
          groups: groupsList.length ? groupsList : undefined,
        };
      }
    }
    return Object.keys(result).length ? (result as T) : undefined;
  }

  private getLocalHandler(id: string, version: number) {
    let current = version;
    let migrateData = (data: unknown) => data;
    while (!this.definedJobs[id]?.[String(current)]) {
      const migration = this.handlerMigrations[id]?.[String(current)];
      if (!migration) throw new Error(`Function ${id} v${version} is unavailable`);
      const previous = migrateData;
      migrateData = (data) => migration.migrateFn(previous(data));
      current = migration.targetVersion;
    }
    return {
      definition: this.definedJobs[id]![String(current)]!,
      version: current,
      migrateData,
    };
  }

  async migrateHandler<T extends ZodType, U extends ZodType>(
    id: string,
    from: Pick<JobDefinition<T>, "dataSchema" | "version">,
    to: Omit<JobDefinition<U>, "id">,
    migrateFn: (data: z.infer<T>) => z.infer<U>,
  ) {
    const registered = this.registerJob({ ...to, id });
    const migrations = this.handlerMigrations[id] ?? {};
    migrations[String(from.version)] = { targetVersion: to.version, migrateFn: migrateFn as (data: unknown) => unknown };
    this.handlerMigrations[id] = migrations;
    const affected = await this.database.db.select().from(schedules).where(
      and(eq(schedules.functionId, id), eq(schedules.functionVersion, from.version)),
    );
    for (const schedule of affected) {
      const nextData = schedule.data ? migrateFn(JSON.parse(schedule.data)) : migrateFn(undefined as z.infer<T>);
      await this.database.db.update(schedules).set({
        data: nextData === undefined ? null : JSON.stringify(nextData),
        functionVersion: to.version,
        updatedAt: new Date(),
      }).where(eq(schedules.id, schedule.id));
    }
    return registered;
  }

  async migrateDatabase() {
    await runMigrations();
    await this.database.db.insert(enscheduleMeta).values({
      id: 1,
      driverVersion: DRIVER_VERSION,
      enscheduleVersion: PACKAGE_VERSION,
    }).onConflictDoUpdate({
      target: enscheduleMeta.id,
      set: { driverVersion: DRIVER_VERSION, enscheduleVersion: PACKAGE_VERSION, updatedAt: new Date() },
    });
    if (process.env.ADMIN_ACCOUNT) {
      const [username, password] = process.env.ADMIN_ACCOUNT.split(":", 2);
      if (!username || !password) throw new Error("ADMIN_ACCOUNT must be username:password");
      await this.register({ username, password, name: "Admin", admin: true });
    }
  }

  private async checkVersion() {
    const [meta] = await this.database.db.select().from(enscheduleMeta).where(eq(enscheduleMeta.id, 1));
    if (!meta) throw new Error("Database not migrated");
    if (meta.driverVersion !== DRIVER_VERSION) throw new Error("Database driver version mismatch; run migrations");
  }

  async registerWorker(attempt = 0): Promise<DbWorker> {
    try {
      const definitions = Object.values(this.definedJobs).flatMap((versions) =>
        Object.values(versions ?? {}).map(createPublicJobDefinition),
      );
      const current = this.registeredWorker
        ? await this.database.db.query.workers.findFirst({ where: eq(workers.id, this.registeredWorker.id) })
        : undefined;
      if (current) {
        const [updated] = await this.database.db.update(workers).set({ lastReached: new Date(), updatedAt: new Date() })
          .where(eq(workers.id, current.id)).returning();
        return (this.registeredWorker = updated!);
      }

      const siblings = await this.database.db.select().from(workers).where(eq(workers.workerId, this.workerInstance.workerId));
      const candidate = {
        title: this.workerInstance.title,
        description: this.workerInstance.description ?? null,
        pollInterval: this.pollInterval,
        definitions,
        defaultFunctionAccess: this.defaultFunctionAccess ?? null,
        defaultScheduleAccess: this.defaultScheduleAccess ?? null,
        defaultRunAccess: this.defaultRunAccess ?? null,
      };
      const hash = workerHash(candidate);
      const latestVersion = Math.max(0, ...siblings.map((worker) => worker.version));
      const version = siblings.some((worker) => workerHash(worker) === hash)
        ? latestVersion || 1
        : latestVersion + 1;
      const [created] = await this.database.db.insert(workers).values({
        workerId: this.workerInstance.workerId,
        instanceId: this.workerInstance.instanceId,
        version,
        definitions,
        description: this.workerInstance.description,
        lastReached: new Date(),
        title: this.workerInstance.title,
        hostname: os.hostname(),
        pollInterval: this.pollInterval,
        defaultFunctionAccess: this.defaultFunctionAccess,
        defaultScheduleAccess: this.defaultScheduleAccess,
        defaultRunAccess: this.defaultRunAccess,
      }).onConflictDoUpdate({
        target: workers.instanceId,
        set: { lastReached: new Date(), updatedAt: new Date(), definitions, version },
      }).returning();
      return (this.registeredWorker = created!);
    } catch (error) {
      if (attempt >= 10) throw error;
      await Bun.sleep(Math.min(100 * 2 ** attempt, 5000));
      return this.registerWorker(attempt + 1);
    }
  }

  async updatePollInterval(pollInterval: number) {
    const polling = this.isPolling;
    this.stopPolling();
    this.pollInterval = pollInterval;
    this.registeredWorker = undefined;
    this.workerInstance.instanceId = shortHash(crypto.randomUUID());
    if (polling) await this.startPolling({ dontMigrate: true });
  }

  async getWorkers(authHeader: Auth): Promise<PublicWorker[]> {
    const user = await this.auth(authHeader);
    if (!user) return [];
    const allWorkers = await this.database.db.select().from(workers);
    const allRuns = await this.database.db.select().from(runs);
    return allWorkers
      .filter((worker) => this.canView(user, worker.access?.view) || user.admin)
      .map((worker) => publicWorker(worker, allRuns.filter((run) => run.workerId === worker.id)));
  }

  async deleteWorkers(ids: number[]) {
    if (ids.length) await this.database.db.delete(workers).where(inArray(workers.id, ids));
    if (this.registeredWorker && ids.includes(this.registeredWorker.id)) this.registeredWorker = undefined;
    return ids;
  }

  async getLatestHandlers(authHeader: Auth) {
    const user = await this.auth(authHeader);
    if (!user) return [];
    const result = new Map<string, PublicJobDefinition>();
    for (const worker of (await this.getWorkers(authHeader)).filter(({ status }) => status === WorkerStatus.UP)) {
      for (const definition of worker.definitions) {
        if (!user.admin && !this.canView(user, definition.access?.view)) continue;
        const current = result.get(definition.id);
        if (!current || definition.version > current.version) result.set(definition.id, definition);
      }
    }
    return [...result.values()];
  }

  async getLatestHandler(functionId: string, authHeader: Auth) {
    const definition = (await this.getLatestHandlers(authHeader)).find(({ id }) => id === functionId);
    if (!definition) throw new Error("Function not found");
    return definition;
  }

  private signature(functionId: string, runAt: Date | undefined, data: unknown, cron?: string) {
    const rounded = cron ? "cron-expression" : runAt ? Math.floor(runAt.getTime() / 1000) * 1000 : "manual";
    return `${functionId}-${rounded}-${JSON.stringify(data)}${cron ? `-${CronExpressionParser.parse(cron).stringify()}` : ""}`;
  }

  protected async createJobSchedule({
    functionId,
    title,
    description,
    functionVersion,
    data,
    options = {},
  }: {
    functionId: string;
    title: string;
    description?: string;
    functionVersion: number;
    data: unknown;
    options?: CreateJobScheduleOptions;
  }) {
    const local = this.definedJobs[functionId]?.[String(functionVersion)]
      ? { version: functionVersion, migrateData: (value: unknown) => value }
      : this.handlerMigrations[functionId]?.[String(functionVersion)]
        ? this.getLocalHandler(functionId, functionVersion)
        : { version: functionVersion, migrateData: (value: unknown) => value };
    const migratedData = local.migrateData(data);
    const normalizedCron = options.cronExpression
      ? CronExpressionParser.parse(options.cronExpression).stringify()
      : undefined;
    const signature = this.signature(functionId, options.runAt, migratedData, normalizedCron);
    const existing = options.eventId
      ? await this.database.db.query.schedules.findFirst({ where: eq(schedules.eventId, options.eventId) })
      : await this.database.db.query.schedules.findFirst({
          where: and(eq(schedules.signature, signature), eq(schedules.claimed, false)),
        });
    const values = {
      workerId: options.workerId,
      functionId,
      functionVersion: local.version,
      data: migratedData === undefined ? null : JSON.stringify(migratedData),
      signature,
      eventId: options.eventId,
      retryFailedJobs: options.retryFailedJobs ?? false,
      maxRetries: options.maxRetries ?? -1,
      title,
      description,
      runAt: options.runAt,
      runNow: options.runNow ?? false,
      cronExpression: normalizedCron,
      failureTriggerId: options.failureTrigger,
      defaultRunAccess: options.defaultRunAccess,
      access: options.access,
      claimed: false,
      updatedAt: new Date(),
    };
    if (existing) {
      if (!options.eventId) return [existing, "unchanged"] as const;
      const [updated] = await this.database.db.update(schedules).set(values).where(eq(schedules.id, existing.id)).returning();
      return [updated!, "updated"] as const;
    }
    const [created] = await this.database.db.insert(schedules).values(values).returning();
    return [created!, "created"] as const;
  }

  async scheduleJob(
    authHeader: Auth,
    definition: string | JobDefinition,
    functionVersion: number,
    data: unknown,
    options: ScheduleJobOptions,
  ): Promise<ScheduleJobResult> {
    const functionId = typeof definition === "string" ? definition : definition.id;
    let runAt = options.runAt;
    if (options.cronExpression) runAt = CronExpressionParser.parse(options.cronExpression).next().toDate();
    const [schedule, status] = await this.createJobSchedule({
      functionId,
      title: options.title,
      description: options.description,
      functionVersion,
      data,
      options: { ...options, runAt },
    });
    const record = (await this.scheduleRecord(schedule.id))!;
    return {
      schedule: publicSchedule(record, this.definition(record.functionId, record.functionVersion, await this.getWorkers(authHeader))),
      status,
    };
  }

  async getSchedules(authHeader: Auth, filter: z.output<typeof SchedulesFilterSchema> = {}) {
    const allWorkers = await this.getWorkers(authHeader);
    const where = and(
      filter.functionId ? eq(schedules.functionId, filter.functionId) : undefined,
      filter.eventId ? eq(schedules.eventId, filter.eventId) : undefined,
    );
    const records = await this.database.db.query.schedules.findMany({
      where,
      orderBy: [desc(schedules.createdAt)],
      with: { lastRun: { with: { worker: true } } },
    });
    return records.map((schedule) =>
      publicSchedule(
        schedule as ScheduleRecord,
        this.definition(schedule.functionId, schedule.functionVersion, allWorkers),
      ),
    );
  }

  async getSchedule(authHeader: Auth, id: number) {
    const record = await this.scheduleRecord(id);
    if (!record) return undefined;
    return publicSchedule(record, this.definition(record.functionId, record.functionVersion, await this.getWorkers(authHeader)));
  }

  async updateSchedule(authHeader: Auth, payload: z.output<typeof ScheduleUpdatePayloadSchema>) {
    const existing = await this.scheduleRecord(payload.id);
    if (!existing) throw new Error("Schedule not found");
    const values: Partial<typeof schedules.$inferInsert> = { updatedAt: new Date() };
    if (payload.title !== undefined) values.title = payload.title;
    if (payload.description !== undefined) values.description = payload.description;
    if (payload.data !== undefined) values.data = payload.data;
    if (payload.runAt !== undefined) {
      values.runAt = payload.runAt;
      values.claimed = payload.runAt === null;
    }
    if (payload.runNow !== undefined) values.runNow = payload.runNow;
    if (payload.retryFailedJobs !== undefined) values.retryFailedJobs = payload.retryFailedJobs;
    if (payload.maxRetries !== undefined) values.maxRetries = payload.maxRetries;
    await this.database.db.update(schedules).set(values).where(eq(schedules.id, payload.id));
    return (await this.getSchedule(authHeader, payload.id))!;
  }

  async runScheduleNow(id: number) {
    const result = await this.database.db.update(schedules).set({ runNow: true, claimed: false, updatedAt: new Date() })
      .where(eq(schedules.id, id)).returning({ id: schedules.id });
    if (!result.length) throw new Error("Schedule not found");
  }

  async runSchedulesNow(ids: number[]) {
    if (ids.length) await this.database.db.update(schedules).set({ runNow: true, claimed: false, updatedAt: new Date() })
      .where(inArray(schedules.id, ids));
  }

  async unschedule(ids: number[]) {
    if (ids.length) await this.database.db.update(schedules).set({ runAt: null, runNow: false, claimed: false, updatedAt: new Date() })
      .where(inArray(schedules.id, ids));
  }

  async deleteSchedules(ids: number[]) {
    if (ids.length) await this.database.db.delete(schedules).where(inArray(schedules.id, ids));
    return ids;
  }

  async deleteSchedule(authHeader: Auth, id: number) {
    const current = await this.getSchedule(authHeader, id);
    if (!current) throw new Error("Schedule not found");
    await this.database.db.delete(schedules).where(eq(schedules.id, id));
    return current;
  }

  protected async claimUnclaimedOverdueJobs() {
    const definitions = Object.entries(this.definedJobs).flatMap(([functionId, versions]) =>
      Object.keys(versions ?? {}).map((version) => ({ functionId, version: Number(version) })),
    );
    if (!definitions.length) return [];
    const eligible = definitions.map(({ functionId, version }) =>
      and(eq(schedules.functionId, functionId), eq(schedules.functionVersion, version)),
    );
    const claimId = shortHash(crypto.randomUUID());
    const claimedIds: number[] = await this.database.client.begin(async (transaction): Promise<number[]> => {
      const due = await transaction.unsafe<DbSchedule[]>(`
        SELECT * FROM "Schedules"
        WHERE "claimed" = false
          AND ("runAt" <= now() OR "runNow" = true)
          AND ("workerId" IS NULL OR "workerId" = $1)
          AND (${eligible.map((_, index) => `("functionId" = $${index * 2 + 2} AND "functionVersion" = $${index * 2 + 3})`).join(" OR ")})
        ORDER BY "runAt" ASC NULLS LAST
        FOR UPDATE SKIP LOCKED
        LIMIT ${this.maxJobsPerTick}
      `, [
        this.workerInstance.workerId,
        ...definitions.flatMap(({ functionId, version }) => [functionId, version]),
      ]);
      if (!due.length) return [];
      const ids: number[] = due.map(({ id }) => id);
      await transaction.unsafe(
        `UPDATE "Schedules" SET "claimed" = true, "runNow" = false, "claimId" = $1, "updatedAt" = now() WHERE "id" IN (${ids.map((_, index) => `$${index + 2}`).join(", ")})`,
        [claimId, ...ids],
      );
      return ids;
    });
    if (!claimedIds.length) return [];
    return this.database.db.select().from(schedules).where(inArray(schedules.id, claimedIds));
  }

  private async addRunAccess(runId: number, access?: RunAccess) {
    const now = new Date();
    const inserts = [
      [runUserViewAccess, access?.view?.users, "userId"],
      [runGroupViewAccess, access?.view?.groups, "groupId"],
      [runUserViewLogsAccess, access?.viewLogs?.users, "userId"],
      [runGroupViewLogsAccess, access?.viewLogs?.groups, "groupId"],
      [runUserDeleteAccess, access?.delete?.users, "userId"],
      [runGroupDeleteAccess, access?.delete?.groups, "groupId"],
    ] as const;
    for (const [table, ids, column] of inserts) {
      if (!ids?.length) continue;
      await this.database.db.insert(table).values(
        ids.map((id) => ({ runId, [column]: id, createdAt: now, updatedAt: now })) as never,
      ).onConflictDoNothing();
    }
  }

  private async scheduleSingleRun(schedule: DbSchedule) {
    const definition = this.getLocalHandler(schedule.functionId, schedule.functionVersion);
    const worker = await this.registerWorker();
    const [run] = await this.database.db.insert(runs).values({
      scheduledToRunAt: schedule.runAt ?? new Date(),
      startedAt: new Date(),
      data: schedule.data,
      workerId: worker.id,
      scheduleId: schedule.id,
      functionId: definition.definition.id,
      functionVersion: definition.version,
      scheduleTitle: `${schedule.title}, #${schedule.id}`,
      workerTitle: `${worker.title}, #${worker.id}`,
    }).returning();
    await this.addRunAccess(run!.id, schedule.defaultRunAccess ?? undefined);
    await this.database.db.update(schedules).set({
      numRuns: sql`${schedules.numRuns} + 1`,
      lastRunId: run!.id,
      updatedAt: new Date(),
    }).where(eq(schedules.id, schedule.id));
    await this.runDefinition(
      {
        functionId: schedule.functionId,
        migratedData: definition.migrateData(schedule.data ? JSON.parse(schedule.data) : undefined),
        version: definition.version,
      },
      run!,
    );
    await this.database.db.update(workers).set({ lastRunId: run!.id, updatedAt: new Date() })
      .where(eq(workers.id, worker.id));
    return (await this.runRecord(run!.id))!;
  }

  async runDefinition(message: RunHandlerInCp, run: DbRun) {
    const definition = this.getLocalHandler(message.functionId, message.version);
    const nfs = await this.getNafs();
    const logFile = `/${run.id}-${new Date().toISOString()}.log`;
    const output: string[] = [];
    const timestamp = () => `${new Date().toISOString()} `;
    const originalLog = console.log;
    const originalError = console.error;
    const capture = (...args: unknown[]) => {
      output.push(`${timestamp()}${args.map(String).join(" ")}\n`);
    };
    let exitSignal = "0";
    try {
      console.log = (...args: unknown[]) => {
        if (this.logJobs) originalLog(...args);
        capture(...args);
      };
      console.error = (...args: unknown[]) => {
        if (this.logJobs) originalError(...args);
        capture(...args);
      };
      await definition.definition.job(message.migratedData);
    } catch (error) {
      capture(error);
      exitSignal = "1";
    } finally {
      console.log = originalLog;
      console.error = originalError;
    }
    const text = output.join("");
    await nfs.promises.writeFile(logFile, text);
    await this.database.db.update(runs).set({
      logFile,
      logFileSize: Buffer.byteLength(text),
      logFileRowCount: text.split("\n").filter(Boolean).length,
      exitSignal,
      finishedAt: new Date(),
      updatedAt: new Date(),
    }).where(eq(runs.id, run.id));
    return { exitSignal };
  }

  retryStrategy(schedule: PublicJobSchedule) {
    return Math.min(60_000 * 2 ** schedule.retries, 5 * 60_000);
  }

  protected async runOverdueJobs() {
    const claimed = await this.claimUnclaimedOverdueJobs();
    for (const schedule of claimed) {
      try {
        const run = await this.scheduleSingleRun(schedule);
        const failed = run.exitSignal !== "0";
        const retry = schedule.retryFailedJobs && failed &&
          (schedule.maxRetries === -1 || schedule.retries < schedule.maxRetries - 1);
        if (retry) {
          const record = (await this.scheduleRecord(schedule.id))!;
          await this.database.db.update(schedules).set({
            runAt: new Date(Date.now() + this.retryStrategy(publicSchedule(record, schedule.functionId))),
            claimed: false,
            retries: schedule.retries + 1,
            updatedAt: new Date(),
          }).where(eq(schedules.id, schedule.id));
          continue;
        }
        if (failed && schedule.failureTriggerId) await this.runScheduleNow(schedule.failureTriggerId);
        const set: Partial<typeof schedules.$inferInsert> = { updatedAt: new Date() };
        if (schedule.cronExpression) {
          set.runAt = CronExpressionParser.parse(schedule.cronExpression).next().toDate();
          set.claimed = false;
        }
        if (schedule.retryFailedJobs) set.retries = failed ? schedule.maxRetries : -1;
        await this.database.db.update(schedules).set(set).where(eq(schedules.id, schedule.id));
      } catch (error) {
        console.error("Could not run function", error);
      }
    }
    return claimed;
  }

  async getRuns(options: ListRunsOptions): Promise<{ count: number; rows: PublicJobRun[] }> {
    if (!options.authHeader) return { count: 0, rows: [] };
    const user = await this.auth(options.authHeader);
    if (!user) return { count: 0, rows: [] };
    let allowedIds: number[] | undefined;
    if (!user.admin) {
      const direct = user.userId
        ? await this.database.db.select({ id: runUserViewAccess.runId }).from(runUserViewAccess)
            .where(eq(runUserViewAccess.userId, user.userId))
        : [];
      const groupRows = user.groups.length
        ? await this.database.db.select({ id: runGroupViewAccess.runId }).from(runGroupViewAccess)
            .where(inArray(runGroupViewAccess.groupId, user.groups))
        : [];
      allowedIds = [...new Set([...direct, ...groupRows].map(({ id }) => id))];
      if (!allowedIds.length) return { count: 0, rows: [] };
    }
    const where = and(
      options.scheduleId ? eq(runs.scheduleId, options.scheduleId) : undefined,
      allowedIds ? inArray(runs.id, allowedIds) : undefined,
    );
    const [countRow] = await this.database.db.select({ count: sql<number>`count(*)::int` }).from(runs).where(where);
    const order = options.order?.[0];
    const columns = { id: runs.id, startedAt: runs.startedAt, finishedAt: runs.finishedAt, createdAt: runs.createdAt } as const;
    const orderColumn = order && order[0] in columns ? columns[order[0] as keyof typeof columns] : runs.startedAt;
    const records = await this.database.db.select().from(runs).where(where)
      .orderBy(order?.[1] === "ASC" ? asc(orderColumn) : desc(orderColumn))
      .limit(options.limit ?? 10_000).offset(options.offset ?? 0);
    const availableWorkers = await this.getWorkers(options.authHeader);
    const publicRuns = await Promise.all(records.map(async (run) => {
      const worker = run.workerId
        ? await this.database.db.query.workers.findFirst({ where: eq(workers.id, run.workerId) })
        : undefined;
      const schedule = run.scheduleId ? await this.scheduleRecord(run.scheduleId) : undefined;
      return {
        ...serializeRun({ ...run, worker }),
        worker: worker ? publicWorker(worker, []) : run.workerTitle,
        jobSchedule: schedule
          ? publicSchedule(schedule, this.definition(run.functionId, run.functionVersion, availableWorkers))
          : run.scheduleTitle,
        jobDefinition: this.definition(run.functionId, run.functionVersion, availableWorkers),
      } satisfies PublicJobRun;
    }));
    return { count: countRow?.count ?? 0, rows: publicRuns };
  }

  async getRun(authHeader: Auth, id: number): Promise<PublicJobRun> {
    const result = await this.getRuns({ authHeader, scheduleId: undefined, limit: 1, offset: 0, order: [["id", "DESC"]] });
    const direct = result.rows.find((run) => run.id === id);
    if (direct) return direct;
    const run = await this.runRecord(id);
    if (!run) throw new Error("Run not found");
    const availableWorkers = await this.getWorkers(authHeader);
    const schedule = run.scheduleId ? await this.scheduleRecord(run.scheduleId) : undefined;
    return {
      ...serializeRun(run),
      worker: run.worker ? publicWorker(run.worker, []) : run.workerTitle,
      jobSchedule: schedule ? publicSchedule(schedule, this.definition(run.functionId, run.functionVersion, availableWorkers)) : run.scheduleTitle,
      jobDefinition: this.definition(run.functionId, run.functionVersion, availableWorkers),
    };
  }

  async deleteRun(authHeader: Auth, id: number) {
    const current = await this.getRun(authHeader, id);
    await this.database.db.delete(runs).where(eq(runs.id, id));
    return current;
  }

  async deleteRuns(ids: number[]) {
    if (ids.length) await this.database.db.delete(runs).where(inArray(runs.id, ids));
    return ids;
  }

  async reset(authHeader: Auth) {
    const user = await this.auth(authHeader);
    if (!user?.admin) return false;
    await this.database.db.transaction(async (tx) => {
      await tx.delete(runs);
      await tx.delete(schedules);
      await tx.delete(workers);
    });
    this.registeredWorker = undefined;
    await this.registerWorker();
    return true;
  }

  private async getNafs() {
    if (!this.nafsInstance) {
      this.nafsInstance = await nafs(this.nafsUri);
      await this.nafsInstance.promises.mkdir("/", { recursive: true });
    }
    return this.nafsInstance;
  }

  async streamLogs(authHeader: Auth, id: number): Promise<Readable | undefined> {
    if (!(await this.auth(authHeader))) return undefined;
    const run = await this.runRecord(id);
    if (!run?.logFile) return undefined;
    return (await this.getNafs()).createReadStream(run.logFile);
  }

  async getLogs(authHeader: Auth, id: number) {
    if (!(await this.auth(authHeader))) return undefined;
    const run = await this.runRecord(id);
    if (!run?.logFile) return undefined;
    return (await (await this.getNafs()).promises.readFile(run.logFile, "utf8")).toString();
  }

  private scrypt(password: string, salt: string) {
    return new Promise<Buffer>((resolve, reject) =>
      crypto.scrypt(password, salt, 64, { N: 16384, r: 8, p: 1 }, (error, key) =>
        error ? reject(error) : resolve(key),
      ),
    );
  }

  async register({ username, email, password, name, admin = false }: {
    username: string; email?: string; password: string; name: string; admin?: boolean;
  }) {
    const existing = await this.database.db.query.users.findFirst({ where: eq(users.username, username) });
    let user = existing;
    if (!user) {
      const salt = crypto.randomBytes(16).toString("hex");
      const hash = await this.scrypt(password, salt);
      [user] = await this.database.db.insert(users).values({
        username, email, name, admin, password: `${salt}:${hash.toString("hex")}`,
      }).returning();
    }
    return { access: await this.login(username, password), user: user! };
  }

  private accessToken(user: DbUser) {
    return jwt.sign({ userId: user.id, admin: user.admin }, this.accessTokenSecret, { expiresIn: "15m" });
  }

  private createRefreshToken(userId: number) {
    return jwt.sign({ userId }, this.refreshTokenSecret, { expiresIn: "7d" });
  }

  async login(username: string, password: string) {
    const user = await this.database.db.query.users.findFirst({ where: eq(users.username, username) });
    if (!user) return undefined;
    const [salt, expected] = user.password.split(":");
    const actual = await this.scrypt(password, salt!);
    const expectedBytes = Uint8Array.from(Buffer.from(expected!, "hex"));
    const actualBytes = Uint8Array.from(actual);
    if (expectedBytes.byteLength !== actualBytes.byteLength || !crypto.timingSafeEqual(expectedBytes, actualBytes)) return undefined;
    const refreshToken = this.createRefreshToken(user.id);
    await this.database.db.insert(sessions).values({ userId: user.id, refreshToken });
    return { accessToken: this.accessToken(user), refreshToken };
  }

  async refreshToken(refreshToken: string) {
    try {
      const decoded = jwt.verify(refreshToken, this.refreshTokenSecret) as { userId: number };
      const session = await this.database.db.query.sessions.findFirst({
        where: and(eq(sessions.userId, decoded.userId), eq(sessions.refreshToken, refreshToken)),
      });
      const user = await this.database.db.query.users.findFirst({ where: eq(users.id, decoded.userId) });
      if (!session || !user) return undefined;
      const next = this.createRefreshToken(user.id);
      await this.database.db.update(sessions).set({ refreshToken: next, updatedAt: new Date() })
        .where(eq(sessions.id, session.id));
      return { accessToken: this.accessToken(user), refreshToken: next };
    } catch {
      return undefined;
    }
  }

  async logout(refreshToken: string, allDevices: boolean) {
    if (allDevices) {
      try {
        const decoded = jwt.verify(refreshToken, this.refreshTokenSecret) as { userId: number };
        await this.database.db.delete(sessions).where(eq(sessions.userId, decoded.userId));
      } catch {
        return;
      }
    } else {
      await this.database.db.delete(sessions).where(eq(sessions.refreshToken, refreshToken));
    }
  }

  async getUser(authHeader: Auth, id: number) {
    const auth = await this.auth(authHeader);
    if (!auth || (!auth.admin && auth.userId !== id)) return undefined;
    const user = await this.database.db.query.users.findFirst({ where: eq(users.id, id) });
    return user ? createPublicUser(user) : undefined;
  }

  async getUsers(authHeader: Auth) {
    const auth = await this.auth(authHeader);
    if (!auth?.admin) return [];
    return (await this.database.db.select().from(users)).map(createPublicUser);
  }

  async startPolling({ dontMigrate = false }: { dontMigrate?: boolean } = {}) {
    this.isPolling = true;
    if (!dontMigrate) await this.migrateDatabase();
    await this.checkVersion();
    await this.registerWorker();
    this.pollingStartTimerId = setTimeout(() => {
      this.pollingIntervalId = setInterval(() => void this.tick(), this.pollInterval * 1000);
    }, 1000 - (Date.now() % 1000));
  }

  stopPolling() {
    this.isPolling = false;
    if (this.pollingStartTimerId) clearTimeout(this.pollingStartTimerId);
    if (this.pollingIntervalId) clearInterval(this.pollingIntervalId);
  }

  protected async tick() {
    await this.checkVersion();
    await this.registerWorker();
    await this.runOverdueJobs();
  }

  async listenForIncomingRuns() {
    return false;
  }
}

export class TestBackend extends PrivateBackend {
  public getDefinedJobs() { return this.definedJobs; }
  public getWorkerInstance() { return this.workerInstance; }
  public setRegisteredWorker(worker: DbWorker | undefined) { this.registeredWorker = worker; }
  public claimUnclaimedOverdueJobs() { return super.claimUnclaimedOverdueJobs(); }
  public runOverdueJobs() { return super.runOverdueJobs(); }
  public tick() { return super.tick(); }
  public createJobSchedule(options: Parameters<PrivateBackend["createJobSchedule"]>[0]) {
    return super.createJobSchedule(options);
  }
}
