import * as cp from "node:child_process";
import * as crypto from "node:crypto";
import * as readline from "node:readline";
import os from "node:os";
import type { Readable } from "node:stream";
import stream from "node:stream";
import { nafs } from "nafs";
import type {
  AuthHeader,
  FunctionAccess,
  JobDefinition,
  ListRunsOptions,
  PublicJobDefinition,
  PublicJobRun,
  PublicJobSchedule,
  PublicWorker,
  PublicWorkerSchema,
  RunAccess,
  RunHandlerInCp,
  ScheduleAccess,
  ScheduleJobOptions,
  ScheduleJobResult,
  ScheduleUpdatePayloadSchema,
  SchedulesFilterSchema,
  SerializedRun,
  UserSchema,
  WorkerAccess,
  UserAuthSchema,
} from "@enschedule/types";
import {
  JobDefinitionSchema,
  RunHandlerInCpSchema,
  RunStatus,
  ScheduleStatus,
  WorkerStatus,
  typeAssert,
} from "@enschedule/types";
import { parseExpression } from "cron-parser";
import * as jwt from "jsonwebtoken";
import { pascalCase } from "pascal-case";
import type {
  CreationOptional,
  ForeignKey,
  HasManyAddAssociationMixin,
  HasManyAddAssociationsMixin,
  HasManyCountAssociationsMixin,
  HasManyCreateAssociationMixin,
  HasManyGetAssociationsMixin,
  HasManyHasAssociationMixin,
  HasManyHasAssociationsMixin,
  HasManyRemoveAssociationMixin,
  HasManyRemoveAssociationsMixin,
  HasManySetAssociationsMixin,
  HasOneCreateAssociationMixin,
  HasOneGetAssociationMixin,
  HasOneSetAssociationMixin,
  InferAttributes,
  InferCreationAttributes,
  NonAttribute,
  Optional,
  Order,
  WhereOptions,
} from "sequelize";
import { DataTypes, Model, Op, Sequelize } from "sequelize";
import { SequelizeStorage, Umzug } from "umzug";
import type { ZodType } from "zod";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { createTypeAlias, printNode, zodToTs } from "zod-to-ts";
import type { SeqConstructorOptions } from "./env-sequalize-options";
import { envSequalizeOptions } from "./env-sequalize-options";
import { log } from "./log";
import { migrations as databaseMigrations } from "./migrations";
import { version as packageVersion } from "./version";

function createWorkerHash({
  title,
  description,
  pollInterval,
  definitions,
  defaultFunctionAccess,
  defaultScheduleAccess,
  defaultRunAccess,
}: {
  title: string;
  description?: null | string;
  pollInterval: number;
  definitions: PublicJobDefinition[];
  defaultFunctionAccess?: FunctionAccess;
  defaultScheduleAccess?: ScheduleAccess;
  defaultRunAccess?: RunAccess;
}) {
  [defaultFunctionAccess, defaultScheduleAccess, defaultRunAccess]
    .map((access) => {
      if (!access) return "EMPTY";
      return JSON.stringify(access);
    })
    .join("|");
  return createShortShaHash(
    title +
      (description || "") +
      String(pollInterval) +
      definitions
        .slice(0)
        .sort((a, b) => a.id.localeCompare(b.id))
        .map((definition) => {
          return definition.id + String(definition.version);
        })
        .join("")
  );
}

const getWorkerStatus = (dbWorker: Worker): WorkerStatus => {
  const pollInterval = dbWorker.pollInterval;
  const currentTime = Date.now();
  const lastReached = currentTime - dbWorker.lastReached.getTime();
  const pendingThreshold = pollInterval * 1000 + 5 * 1000;
  const downThreshold = 2 * pollInterval * 1000 + 5 * 1000;

  let status: WorkerStatus = WorkerStatus.UP;

  if (lastReached > pendingThreshold) {
    status = WorkerStatus.PENDING;
  }
  if (lastReached > downThreshold) {
    status = WorkerStatus.DOWN;
  }
  return status;
};

const createPublicWorker = (dbWorker: Worker): PublicWorker => {
  const status = getWorkerStatus(dbWorker);

  return {
    versionHash: createWorkerHash(dbWorker),
    createdAt: dbWorker.createdAt,
    definitions: dbWorker.definitions,
    description: dbWorker.description ?? undefined,
    hostname: dbWorker.hostname,
    id: dbWorker.id,
    instanceId: dbWorker.instanceId,
    lastReached: dbWorker.lastReached,
    title: dbWorker.title,
    pollInterval: dbWorker.pollInterval,
    version: dbWorker.version,
    workerId: dbWorker.workerId,
    runs:
      dbWorker.runs?.map((run) => {
        return serializeRun(run);
      }) ?? [],
    lastRun: dbWorker.lastRun ? serializeRun(dbWorker.lastRun) : undefined,
    status,
    defaultFunctionAccess: dbWorker.defaultFunctionAccess,
    defaultScheduleAccess: dbWorker.defaultScheduleAccess,
    defaultRunAccess: dbWorker.defaultRunAccess,
    access: dbWorker.access,
  };
};

/**
 * Converts 4-space indentation in a code block to 2-space indentation.
 *
 * @param code - A string (e.g. a code snippet) to fix indentation.
 * @returns A new string where every group of 4 spaces is replaced by 2 spaces.
 */
function fixIndentation(code: string): string {
  interface IndentationGroups {
    indentation: string; // Named capture group that matches leading spaces
  }

  return code.replace(
    /^(?<indentation>(?: {4})+)/gm,
    (
      match: string, // The entire match for the leading spaces
      p1: string, // The substring for the first capturing group
      offset: number, // Position of the match
      fullString: string, // The entire input string
      groups?: IndentationGroups // The named capture groups object
    ) => {
      // If we somehow don't have named capture groups, bail out
      if (!groups?.indentation) {
        return match;
      }
      // Each group is guaranteed to be a multiple of 4 spaces in length
      const originalLength = groups.indentation.length;
      // Replace 4 spaces with 2 spaces
      const newLength = (originalLength / 4) * 2;
      return " ".repeat(newLength);
    }
  );
}

export const createPublicJobDefinition = (
  jobDef: JobDefinition
): PublicJobDefinition => {
  const identifier = pascalCase(jobDef.title);

  const getJsonSchema = () => {
    if (!jobDef.dataSchema) {
      return { codeBlock: undefined, jsonSchema: undefined };
    }
    const { node } = zodToTs(jobDef.dataSchema, identifier);
    const typeAlias = createTypeAlias(node, identifier);

    // This regex finds multiples of 4 leading spaces on each line.
    // We then replace each group of 4 spaces with 2 spaces.
    const codeBlock = fixIndentation(printNode(typeAlias));

    const jsonSchema: Record<string, unknown> = zodToJsonSchema(
      jobDef.dataSchema,
      identifier
    );
    return { codeBlock, jsonSchema };
  };

  const { codeBlock, jsonSchema } = getJsonSchema();

  return {
    version: jobDef.version,
    id: jobDef.id,
    title: jobDef.title,
    description: jobDef.description,
    example: jobDef.example,
    codeBlock,
    jsonSchema,
    access: jobDef.access,
  };
};

export const serializeRun = (run: Run): SerializedRun => {
  return {
    id: Number(run.id),
    createdAt: run.createdAt,
    exitSignal: run.exitSignal ?? undefined,
    finishedAt: run.finishedAt ?? undefined,
    startedAt: run.startedAt,
    scheduledToRunAt: run.scheduledToRunAt,
    data: run.data ?? undefined,
    status: getRunStatus(run),
  };
};

function createPublicUser(user: User): z.output<typeof UserSchema> {
  return {
    admin: Boolean(user.admin),
    createdAt: user.createdAt,
    email: user.email,
    id: user.id,
    name: user.name,
    username: user.username,
  };
}

const getScheduleStatus = (
  schedule: Schedule,
  hasFunction: boolean
): ScheduleStatus => {
  let status = ScheduleStatus.UNSCHEDULED;
  if (schedule.runAt || schedule.runNow === true) {
    status = ScheduleStatus.SCHEDULED;
    if (!hasFunction) {
      status = ScheduleStatus.NO_WORKER;
    }
  }
  if (schedule.lastRun) {
    const runStatus = getRunStatus(schedule.lastRun);

    if (runStatus === RunStatus.RUNNING) {
      status = ScheduleStatus.RUNNING;
    } else if (runStatus === RunStatus.LOST) {
      // if the worker is down, we consider the job lost and the schedule is failed
      status = ScheduleStatus.FAILED;
    } else if (runStatus === RunStatus.FAILED) {
      status = ScheduleStatus.FAILED;
      if (schedule.retryFailedJobs === true) {
        if (
          schedule.runAt &&
          (schedule.maxRetries === -1 || schedule.retries < schedule.maxRetries)
        ) {
          status = ScheduleStatus.RETRYING;
        }
      }
    } else if (schedule.runNow === true) {
      status = ScheduleStatus.SCHEDULED;
    } else {
      status = ScheduleStatus.SUCCESS;
    }
  }
  return status;
};

export const createPublicJobSchedule = (
  schedule: Schedule,
  jobDef: PublicJobDefinition | string
): PublicJobSchedule => {
  const status = getScheduleStatus(schedule, typeof jobDef !== "string");
  return {
    id: schedule.id,
    title: schedule.title,
    description: schedule.description ?? undefined,
    retryFailedJobs: schedule.retryFailedJobs,
    retries: schedule.retries,
    maxRetries: schedule.maxRetries,
    runAt: schedule.runAt || undefined,
    runNow: schedule.runNow,
    cronExpression: schedule.cronExpression || undefined,
    lastRun: schedule.lastRun ? serializeRun(schedule.lastRun) : undefined,
    functionId: schedule.functionId,
    createdAt: schedule.createdAt,
    jobDefinition: jobDef,
    numRuns: schedule.numRuns,
    data: schedule.data ?? undefined,
    status,
    eventId: schedule.eventId ?? undefined,
    defaultRunAccess: schedule.defaultRunAccess,
  };
};

const getRunStatus = (run: Run): RunStatus => {
  let status = RunStatus.SUCCESS;
  if (!run.finishedAt) {
    status = RunStatus.RUNNING;
    if (!run.worker || getWorkerStatus(run.worker) === WorkerStatus.DOWN) {
      status = RunStatus.LOST;
    }
  } else if (run.exitSignal !== "0") {
    status = RunStatus.FAILED;
  }
  return status;
};

export const createPublicJobRun = (
  run: Run,
  schedule: Schedule | string,
  jobDef: PublicJobDefinition | string
): PublicJobRun => {
  const status = getRunStatus(run);
  return {
    id: Number(run.id),
    createdAt: run.createdAt,
    exitSignal: run.exitSignal ?? undefined,
    finishedAt: run.finishedAt ?? undefined,
    startedAt: run.startedAt,
    scheduledToRunAt: run.scheduledToRunAt,
    jobDefinition: jobDef,
    jobSchedule:
      typeof schedule === "string"
        ? schedule
        : createPublicJobSchedule(schedule, jobDef),
    data: run.data ?? undefined,
    worker: run.worker ? createPublicWorker(run.worker) : run.workerTitle,
    status,
  };
};

export interface StreamHandle {
  stdout: stream.PassThrough;
  stderr: stream.PassThrough;
  toggleSaveOutput: (on: boolean) => void;
}

interface CreateJobScheduleOptions {
  cronExpression?: string;
  eventId?: string;
  runAt?: Date;
  retryFailedJobs?: boolean;
  maxRetries?: number;
  failureTrigger?: number;
  workerId?: string;
  defaultRunAccess?: RunAccess;
  access?: ScheduleAccess;
  runNow?: boolean;
}

typeAssert<
  // omit desc and title because they are passed as arguments to createJobSchedule
  Required<Omit<ScheduleJobOptions, "description" | "title">>,
  Required<CreateJobScheduleOptions>
>();
// and the opposite
typeAssert<
  Required<CreateJobScheduleOptions>,
  Required<Omit<ScheduleJobOptions, "description" | "title">>
>();

type ScheduleAttributes = InferAttributes<
  Schedule,
  { omit: "runs" | "lastRun" }
>;

type WorkerAttributes = InferAttributes<
  Worker,
  {
    omit: "runs" | "lastRun";
  }
>;

export class EnscheduleMeta extends Model<
  InferAttributes<EnscheduleMeta>,
  InferCreationAttributes<EnscheduleMeta>
> {
  declare id: CreationOptional<number>;
  declare driverVersion: number;
  declare enscheduleVersion: string;
}

export class Worker extends Model<
  WorkerAttributes,
  InferCreationAttributes<Worker>
> {
  declare id: CreationOptional<number>;
  declare workerId: string;

  declare version: number;

  declare pollInterval: number;
  declare title: string;
  declare description?: string | null;
  declare definitions: PublicJobDefinition[];

  declare access?: CreationOptional<WorkerAccess>;
  declare defaultFunctionAccess?: CreationOptional<FunctionAccess>;
  declare defaultScheduleAccess?: CreationOptional<ScheduleAccess>;
  declare defaultRunAccess?: CreationOptional<RunAccess>;

  declare instanceId: string;
  declare createdAt: CreationOptional<Date>;
  declare hostname: string;
  declare lastReached: Date;
  declare runs?: NonAttribute<Run[]> | null;

  declare workerPk: ForeignKey<Worker["id"]>;

  declare lastRun?: NonAttribute<Run> | null;
  declare getLastRun: HasOneGetAssociationMixin<Run>;
  declare setLastRun: HasOneSetAssociationMixin<Run, number>;
  declare createLastRun: HasOneCreateAssociationMixin<Run>;
}

export class User extends Model<
  InferAttributes<User>,
  InferCreationAttributes<User>
> {
  declare id: CreationOptional<number>;
  declare username: string; // unique

  declare name: string;
  declare email?: CreationOptional<string>;
  declare password: string;
  declare createdAt: CreationOptional<Date>;
  declare admin: boolean;
  declare groups: NonAttribute<Group[]> | null;

  declare getGroups: HasManyGetAssociationsMixin<Group>;
  declare addGroup: HasManyAddAssociationMixin<Group, number>;
  declare addGroups: HasManyAddAssociationsMixin<Group, number>;
  declare setGroups: HasManySetAssociationsMixin<Group, number>;
  declare removeGroup: HasManyRemoveAssociationMixin<Group, number>;
  declare removeGroups: HasManyRemoveAssociationsMixin<Group, number>;
  declare hasGroup: HasManyHasAssociationMixin<Group, number>;
  declare hasGroups: HasManyHasAssociationsMixin<Group, number>;
  declare countGroups: HasManyCountAssociationsMixin;
  declare createGroup: HasManyCreateAssociationMixin<Group>;

  //#region access
  declare runViewAccess?: CreationOptional<Run>;
  declare getRunViewAccess: HasManyGetAssociationsMixin<Run>;
  declare addRunViewAccess: HasManyAddAssociationMixin<Run, number>;
  declare setRunViewAccess: HasManySetAssociationsMixin<Run, number>;
  declare removeRunViewAccess: HasManyRemoveAssociationMixin<Run, number>;
  declare hasRunViewAccess: HasManyHasAssociationMixin<Run, number>;
  declare countRunViewAccess: HasManyCountAssociationsMixin;
  declare createRunViewAccess: HasManyCreateAssociationMixin<Run>;

  declare runViewLogsAccess?: CreationOptional<Run>;
  declare getRunViewLogsAccess: HasManyGetAssociationsMixin<Run>;
  declare addRunViewLogsAccess: HasManyAddAssociationMixin<Run, number>;
  declare setRunViewLogsAccess: HasManySetAssociationsMixin<Run, number>;
  declare removeRunViewLogsAccess: HasManyRemoveAssociationMixin<Run, number>;
  declare hasRunViewLogsAccess: HasManyHasAssociationMixin<Run, number>;
  declare countRunViewLogsAccess: HasManyCountAssociationsMixin;
  declare createRunViewLogsAccess: HasManyCreateAssociationMixin<Run>;

  declare runDeleteAccess?: CreationOptional<Run>;
  declare getRunDeleteAccess: HasManyGetAssociationsMixin<Run>;
  declare addRunDeleteAccess: HasManyAddAssociationMixin<Run, number>;
  declare setRunDeleteAccess: HasManySetAssociationsMixin<Run, number>;
  declare removeRunDeleteAccess: HasManyRemoveAssociationMixin<Run, number>;
  declare hasRunDeleteAccess: HasManyHasAssociationMixin<Run, number>;
  declare countRunDeleteAccess: HasManyCountAssociationsMixin;
  declare createRunDeleteAccess: HasManyCreateAssociationMixin<Run>;

  //#endregion access
}

export class Group extends Model<
  InferAttributes<Group>,
  InferCreationAttributes<Group>
> {
  declare id: CreationOptional<number>;
  declare groupName: string; // unique

  declare title: string;
  declare description: string;
  declare createdAt: CreationOptional<Date>;
  declare users: NonAttribute<User[]> | null;

  declare getUsers: HasManyGetAssociationsMixin<User>;
  declare addUser: HasManyAddAssociationMixin<User, number>;
  declare addUsers: HasManyAddAssociationsMixin<User, number>;
  declare setUsers: HasManySetAssociationsMixin<User, number>;
  declare removeUser: HasManyRemoveAssociationMixin<User, number>;
  declare removeUsers: HasManyRemoveAssociationsMixin<User, number>;
  declare hasUser: HasManyHasAssociationMixin<User, number>;
  declare hasUsers: HasManyHasAssociationsMixin<User, number>;
  declare countUsers: HasManyCountAssociationsMixin;
  declare createUser: HasManyCreateAssociationMixin<User>;

  //#region access
  declare runViewAccess?: CreationOptional<Run>;
  declare getRunViewAccess: HasManyGetAssociationsMixin<Run>;
  declare addRunViewAccess: HasManyAddAssociationMixin<Run, number>;
  declare setRunViewAccess: HasManySetAssociationsMixin<Run, number>;
  declare removeRunViewAccess: HasManyRemoveAssociationMixin<Run, number>;
  declare hasRunViewAccess: HasManyHasAssociationMixin<Run, number>;
  declare countRunViewAccess: HasManyCountAssociationsMixin;
  declare createRunViewAccess: HasManyCreateAssociationMixin<Run>;

  declare runViewLogsAccess?: CreationOptional<Run>;
  declare getRunViewLogsAccess: HasManyGetAssociationsMixin<Run>;
  declare addRunViewLogsAccess: HasManyAddAssociationMixin<Run, number>;
  declare setRunViewLogsAccess: HasManySetAssociationsMixin<Run, number>;
  declare removeRunViewLogsAccess: HasManyRemoveAssociationMixin<Run, number>;
  declare hasRunViewLogsAccess: HasManyHasAssociationMixin<Run, number>;
  declare countRunViewLogsAccess: HasManyCountAssociationsMixin;
  declare createRunViewLogsAccess: HasManyCreateAssociationMixin<Run>;

  declare runDeleteAccess?: CreationOptional<Run>;
  declare getRunDeleteAccess: HasManyGetAssociationsMixin<Run>;
  declare addRunDeleteAccess: HasManyAddAssociationMixin<Run, number>;
  declare setRunDeleteAccess: HasManySetAssociationsMixin<Run, number>;
  declare removeRunDeleteAccess: HasManyRemoveAssociationMixin<Run, number>;
  declare hasRunDeleteAccess: HasManyHasAssociationMixin<Run, number>;
  declare countRunDeleteAccess: HasManyCountAssociationsMixin;
  declare createRunDeleteAccess: HasManyCreateAssociationMixin<Run>;

  //#endregion access
}

export class Session extends Model<
  InferAttributes<Session>,
  InferCreationAttributes<Session>
> {
  declare id: CreationOptional<number>;
  declare userId: ForeignKey<User["id"]>;
  declare createdAt: CreationOptional<Date>;
  declare refreshToken: string;
}

export class ApiKey extends Model<
  InferAttributes<ApiKey>,
  InferCreationAttributes<ApiKey>
> {
  declare id: CreationOptional<number>;
  declare userId: ForeignKey<User["id"]>;
  declare key: string;
  declare createdAt: CreationOptional<Date>;
  declare expiresAt: Date;

  declare user: NonAttribute<User>;
}

export class Schedule extends Model<
  ScheduleAttributes,
  InferCreationAttributes<Schedule, { omit: "runs" | "lastRun" }>
> {
  declare id: CreationOptional<number>;
  /**
   * Calculated field. When e.g. running a CRON job this field will update
   */
  declare runAt?: CreationOptional<Date> | null;
  /**
   * When running a job "now" runNow is set to true so that it can be claimed by a worker
   */
  declare runNow: CreationOptional<boolean>;
  declare signature: string;
  declare createdAt: CreationOptional<Date>;
  /**
   * Because createOrUpdate doesn't return whats created / updated, we just do an UPDATE WHERE and add the claimId, and then query for those rows
   */
  declare claimId: CreationOptional<string>;

  declare title: string;
  declare description?: string | null;
  /** job functionId, i.e. the handler the schedule executes */
  declare functionId: string;
  declare cronExpression?: CreationOptional<string> | null;
  declare eventId?: CreationOptional<string> | null;
  declare retryFailedJobs: CreationOptional<boolean>;
  /**
   * defaults to -1, indicating no retries
   */
  declare retries: CreationOptional<number>;
  /**
   * -1 is infinite retries. Will stop retrying when `retires >= maxRetries`
   */
  declare maxRetries: CreationOptional<number>;
  declare claimed: CreationOptional<boolean>;

  // related to the handler
  declare functionVersion: number;
  declare data?: CreationOptional<string> | null;

  declare numRuns: CreationOptional<number>;

  declare getRuns: HasManyGetAssociationsMixin<Run>; // Note the null assertions!
  declare addRun: HasManyAddAssociationMixin<Run, number>;
  declare addRuns: HasManyAddAssociationsMixin<Run, number>;
  declare setRuns: HasManySetAssociationsMixin<Run, number>;
  declare removeRun: HasManyRemoveAssociationMixin<Run, number>;
  declare removeRuns: HasManyRemoveAssociationsMixin<Run, number>;
  declare hasRun: HasManyHasAssociationMixin<Run, number>;
  declare hasRuns: HasManyHasAssociationsMixin<Run, number>;
  declare countRuns: HasManyCountAssociationsMixin;
  declare createRun: HasManyCreateAssociationMixin<Run, "scheduleId">;

  declare getLastRun: HasOneGetAssociationMixin<Run>; // Note the null assertions!
  declare setLastRun: HasOneSetAssociationMixin<Run, number>;
  declare createLastRun: HasOneCreateAssociationMixin<Run>;

  declare lastRun?: NonAttribute<Run> | null;
  declare runs?: NonAttribute<Run[]> | null;

  declare failureTriggerId?: ForeignKey<Schedule["id"]> | null;
  declare workerId?: CreationOptional<string> | null; // optional, a user can say a schedule must run on a worker with a specific workerId

  declare getFailureTrigger: HasOneGetAssociationMixin<Schedule | null>;
  declare setFailureTrigger: HasOneSetAssociationMixin<Schedule, number>;
  declare createFailureTrigger: HasOneCreateAssociationMixin<Schedule>;

  declare failureTrigger?: NonAttribute<Schedule>;

  declare defaultRunAccess?: CreationOptional<RunAccess>;
  declare access?: CreationOptional<ScheduleAccess>;
}

class Run extends Model<InferAttributes<Run>, InferCreationAttributes<Run>> {
  declare id: CreationOptional<number>;
  declare logFile: CreationOptional<string>;
  declare logFileSize: CreationOptional<number>;
  declare logFileRowCount: CreationOptional<number>;
  declare data?: CreationOptional<string> | null;
  declare createdAt: CreationOptional<Date>;
  declare finishedAt: CreationOptional<Date> | null;
  declare startedAt: Date;
  declare scheduledToRunAt: Date;

  declare exitSignal: CreationOptional<string> | null;

  declare scheduleId: ForeignKey<Schedule["id"]>;
  declare workerId: ForeignKey<Worker["id"]>;

  declare getSchedule: HasOneGetAssociationMixin<Schedule | null>; // schedule can be deleted, so it is nullable
  declare setSchedule: HasOneSetAssociationMixin<Schedule, number>;
  declare createSchedule: HasOneCreateAssociationMixin<Schedule>;

  declare functionId: string; // same as schedule.functionId, but in case schedule is deleted the functionId can still be found
  declare functionVersion: number; // same as schedule.functionVersion, but in case schedule is deleted the functionVersion can still be found
  declare scheduleTitle: string; // same as `${schedule.title}, #${schedule.id}`, but in case schedule is deleted a scheduleTitle can still be found
  declare schedule?: NonAttribute<Schedule> | null;

  declare workerTitle: string; // same as `${worker.title}, #${worker.id}`, but in case worker is deleted a workerTitle can still be found
  declare worker?: NonAttribute<Worker> | null;

  //#region access
  declare userViewAccess?: CreationOptional<User[]>;
  declare getUserViewAccess: HasManyGetAssociationsMixin<User>;
  declare addUserViewAccess: HasManyAddAssociationMixin<User, number>;
  declare setUserViewAccess: HasManySetAssociationsMixin<User, number>;
  declare removeUserViewAccess: HasManyRemoveAssociationMixin<User, number>;
  declare hasUserViewAccess: HasManyHasAssociationMixin<User, number>;
  declare countUserViewAccess: HasManyCountAssociationsMixin;
  declare createUserViewAccess: HasManyCreateAssociationMixin<User>;

  declare groupViewAccess?: CreationOptional<Group[]>;
  declare getGroupViewAccess: HasManyGetAssociationsMixin<Group>;
  declare addGroupViewAccess: HasManyAddAssociationMixin<Group, number>;
  declare setGroupViewAccess: HasManySetAssociationsMixin<Group, number>;
  declare removeGroupViewAccess: HasManyRemoveAssociationMixin<Group, number>;
  declare hasGroupViewAccess: HasManyHasAssociationMixin<Group, number>;
  declare countGroupViewAccess: HasManyCountAssociationsMixin;
  declare createGroupViewAccess: HasManyCreateAssociationMixin<Group>;

  declare userViewLogsAccess?: CreationOptional<User[]>;
  declare getUserViewLogsAccess: HasManyGetAssociationsMixin<User>;
  declare addUserViewLogsAccess: HasManyAddAssociationMixin<User, number>;
  declare setUserViewLogsAccess: HasManySetAssociationsMixin<User, number>;
  declare removeUserViewLogsAccess: HasManyRemoveAssociationMixin<User, number>;
  declare hasUserViewLogsAccess: HasManyHasAssociationMixin<User, number>;
  declare countUserViewLogsAccess: HasManyCountAssociationsMixin;
  declare createUserViewLogsAccess: HasManyCreateAssociationMixin<User>;

  declare groupViewLogsAccess?: CreationOptional<Group[]>;
  declare getGroupViewLogsAccess: HasManyGetAssociationsMixin<Group>;
  declare addGroupViewLogsAccess: HasManyAddAssociationMixin<Group, number>;
  declare setGroupViewLogsAccess: HasManySetAssociationsMixin<Group, number>;
  declare removeGroupViewLogsAccess: HasManyRemoveAssociationMixin<
    Group,
    number
  >;
  declare hasGroupViewLogsAccess: HasManyHasAssociationMixin<Group, number>;
  declare countGroupViewLogsAccess: HasManyCountAssociationsMixin;
  declare createGroupViewLogsAccess: HasManyCreateAssociationMixin<Group>;

  declare userDeleteAccess?: CreationOptional<User[]>;
  declare getUserDeleteAccess: HasManyGetAssociationsMixin<User>;
  declare addUserDeleteAccess: HasManyAddAssociationMixin<User, number>;
  declare setUserDeleteAccess: HasManySetAssociationsMixin<User, number>;
  declare removeUserDeleteAccess: HasManyRemoveAssociationMixin<User, number>;
  declare hasUserDeleteAccess: HasManyHasAssociationMixin<User, number>;
  declare countUserDeleteAccess: HasManyCountAssociationsMixin;
  declare createUserDeleteAccess: HasManyCreateAssociationMixin<User>;

  declare groupDeleteAccess?: CreationOptional<Group[]>;
  declare getGroupDeleteAccess: HasManyGetAssociationsMixin<Group>;
  declare addGroupDeleteAccess: HasManyAddAssociationMixin<Group, number>;
  declare setGroupDeleteAccess: HasManySetAssociationsMixin<Group, number>;
  declare removeGroupDeleteAccess: HasManyRemoveAssociationMixin<Group, number>;
  declare hasGroupDeleteAccess: HasManyHasAssociationMixin<Group, number>;
  declare countGroupDeleteAccess: HasManyCountAssociationsMixin;
  declare createGroupDeleteAccess: HasManyCreateAssociationMixin<Group>;
  //#endregion access
}

export const createJobDefinition = <T extends ZodType = ZodType>(
  job: JobDefinition<T>
) => job;

export interface BackendOptions {
  database?: SeqConstructorOptions;
  forkArgv?: string[];
  workerId: string;
  name: string;
  description?: string;
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

function createShortShaHash(input: string) {
  // Create a SHA-256 hash of the input
  const hash = crypto.createHash("sha256").update(input).digest("hex");

  // Return the first 6 characters
  return hash.substring(0, 6);
}

interface Access {
  users?: number[];
  groups?: number[];
}

export class PrivateBackend {
  protected maxJobsPerTick = 4;
  public pollInterval = 5;
  public logJobs = false;
  protected sequelize: Sequelize;
  protected Run: typeof Run;
  protected Schedule: typeof Schedule;
  protected Worker: typeof Worker;
  protected User: typeof User;
  protected Group: typeof Group;
  protected Session: typeof Session;
  protected ApiKey: typeof ApiKey;
  private forkArgv: string[] | undefined;
  protected workerInstance: WorkerInstance;
  protected inlineWorker: boolean;
  private defaultFunctionAccess?: FunctionAccess;
  private defaultScheduleAccess?: ScheduleAccess;
  private defaultRunAccess?: RunAccess;

  private accessTokenSecret: string;
  private refreshTokenSecret: string;
  private nafsUri: string;
  private apiKey?: string;

  constructor(backendOptions: BackendOptions) {
    const {
      database: passedDatabaseOptions,
      forkArgv,
      workerId,
      name,
      description,
      inlineWorker,
      defaultFunctionAccess,
      defaultScheduleAccess,
      defaultRunAccess,
    } = backendOptions;

    this.accessTokenSecret = backendOptions.accessTokenSecret;
    this.refreshTokenSecret = backendOptions.refreshTokenSecret;
    this.nafsUri = backendOptions.nafsUri;
    this.apiKey = backendOptions.apiKey;

    this.defaultFunctionAccess = defaultFunctionAccess;
    this.defaultScheduleAccess = defaultScheduleAccess;
    this.defaultRunAccess = defaultRunAccess;

    this.inlineWorker = Boolean(inlineWorker);

    this.workerInstance = {
      workerId,
      title: name,
      description,
      instanceId: createShortShaHash(String(Math.random())),
    };
    const database = passedDatabaseOptions ?? envSequalizeOptions();
    this.forkArgv = forkArgv;

    const sequelize = database.uri
      ? new Sequelize(database.uri, database)
      : new Sequelize(database);

    this.sequelize = sequelize;

    EnscheduleMeta.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        driverVersion: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        enscheduleVersion: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: "EnscheduleMeta",
        tableName: "EnscheduleMeta",
      }
    );

    Worker.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        version: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        pollInterval: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        title: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        description: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        definitions: {
          type: DataTypes.JSON,
          allowNull: false,
        },
        access: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        defaultFunctionAccess: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        defaultScheduleAccess: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        defaultRunAccess: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        workerId: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        instanceId: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        hostname: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        lastReached: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: "Worker",
      }
    );

    User.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        username: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        name: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        email: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        password: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        admin: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
      },
      {
        sequelize,
        modelName: "User",
      }
    );

    Group.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        groupName: {
          type: DataTypes.STRING,
          allowNull: false,
          unique: true,
        },
        title: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        description: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: "Group",
      }
    );

    Session.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        refreshToken: {
          type: DataTypes.STRING,
          allowNull: false,
        },
      },
      {
        sequelize,
        modelName: "Session",
      }
    );

    ApiKey.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        userId: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        key: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        expiresAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: "ApiKey",
      }
    );

    Schedule.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        workerId: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        functionVersion: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        data: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        signature: {
          type: DataTypes.TEXT,
          allowNull: false,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        claimId: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        eventId: {
          type: DataTypes.STRING,
          allowNull: true,
          unique: true,
        },
        retries: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: -1,
        },
        maxRetries: {
          type: DataTypes.INTEGER,
          allowNull: false,
          defaultValue: -1,
        },
        retryFailedJobs: {
          type: DataTypes.BOOLEAN,
          allowNull: false,
          defaultValue: false,
        },
        title: {
          type: DataTypes.STRING,
          allowNull: false,
        },
        description: {
          type: DataTypes.STRING,
          allowNull: true,
        },
        claimed: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
        runAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        runNow: {
          type: DataTypes.BOOLEAN,
          defaultValue: false,
        },
        functionId: {
          type: DataTypes.STRING(),
          allowNull: false,
        },
        cronExpression: {
          type: DataTypes.STRING(),
          allowNull: true,
        },
        numRuns: {
          type: DataTypes.INTEGER(),
          allowNull: false,
          defaultValue: 0,
        },
        defaultRunAccess: {
          type: DataTypes.JSON,
          allowNull: true,
        },
        access: {
          type: DataTypes.JSON,
          allowNull: true,
        },
      },
      {
        sequelize,
        modelName: "Schedule",
      }
    );

    Run.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
          allowNull: false,
        },
        logFile: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        logFileSize: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        logFileRowCount: {
          type: DataTypes.INTEGER,
          allowNull: true,
        },
        data: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        createdAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        exitSignal: {
          type: DataTypes.TEXT,
          allowNull: true,
        },
        finishedAt: {
          type: DataTypes.DATE,
          allowNull: true,
        },
        startedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        scheduledToRunAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        functionId: {
          type: DataTypes.STRING(),
          allowNull: false,
        },
        functionVersion: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        scheduleTitle: {
          type: DataTypes.STRING(),
          allowNull: false,
        },
        workerTitle: {
          type: DataTypes.STRING(),
          allowNull: false,
        },
        // access: {
        //   type: DataTypes.JSON,
        //   allowNull: true,
        // },
      },
      {
        modelName: "Run",
        sequelize,
      }
    );

    //#region schedule.runs / run.schedule
    /**
     * one-to-many
     * one schedule can have many runs
     */
    Schedule.hasMany(Run, {
      foreignKey: {
        name: "scheduleId", // run.scheduleId
        allowNull: true, // on schedule deletion, runs are not deleted
      },
      as: "runs",
      onDelete: "SET NULL",
    });
    // foreign key on Run, run.scheduleId, run.schedule
    Run.belongsTo(Schedule, {
      foreignKey: {
        name: "scheduleId",
        allowNull: true, // on schedule deletion, runs are not deleted
      },
      as: "schedule",
      onDelete: "SET NULL",
    });
    //#endregion

    //#region worker.runs / run.worker
    /**
     * one-to-many
     * one worker can have many runs
     */
    Worker.hasMany(Run, {
      foreignKey: {
        name: "workerId", // run.workerId
        allowNull: true,
      },
      as: "runs",
      onDelete: "SET NULL",
    });
    // foreign key on Run, run.workerId
    Run.belongsTo(Worker, {
      as: "worker",
      foreignKey: {
        name: "workerId",
        allowNull: true,
      },
      onDelete: "SET NULL",
    });
    //#endregion

    //#region worker.schedules / schedule.worker
    // no foreign keys, because schedule.workerId is just an optional string, pointing to a workerId
    //#endregion

    //#region schedule.lastRun
    /**
     * Fk on run.lastRunId
     */
    Schedule.belongsTo(Run, {
      foreignKey: {
        name: "lastRunId", // schedule.lastRunId
        allowNull: true,
      },
      onDelete: "SET NULL",
      as: "lastRun",
    });

    //#endregion

    //#region worker.lastRun
    Worker.belongsTo(Run, {
      foreignKey: {
        name: "lastRunId", // worker.lastRunId
        allowNull: true,
      },
      onDelete: "SET NULL",
      as: "lastRun",
    });
    //#endregion

    Schedule.belongsTo(Schedule, {
      foreignKey: {
        name: "failureTriggerId",
        allowNull: true,
      },
      as: "failureTrigger",
      onDelete: "SET NULL",
    });

    //#region user.groups / group.users
    /**
     * many-to-many
     * one user can have many groups
     * one group can have many users
     */
    User.belongsToMany(Group, {
      through: "UserGroupAssociation",
      as: "groups",
      onDelete: "CASCADE",
    });
    Group.belongsToMany(User, {
      through: "UserGroupAssociation",
      as: "users",
      onDelete: "CASCADE",
    });
    //#endregion

    //#region user.sessions / session.user
    /**
     * one-to-many
     * one user can have many sessions
     */
    User.hasMany(Session, {
      foreignKey: {
        name: "userId",
        allowNull: false,
      },
      as: "sessions",
      onDelete: "CASCADE",
    });
    Session.belongsTo(User, {
      foreignKey: {
        name: "userId",
        allowNull: false,
      },
      as: "user",
      onDelete: "CASCADE",
    });
    //#endregion

    //#region user.apiKeys / apiKey.user
    /**
     * one-to-many
     * one user can have many api keys
     */
    User.hasMany(ApiKey, {
      foreignKey: {
        name: "userId", // apiKey.userId
        allowNull: false,
      },
      as: "apiKeys",
      onDelete: "CASCADE",
    });
    // foreign key on ApiKey, apiKey.userId
    ApiKey.belongsTo(User, {
      as: "user",
      foreignKey: {
        name: "userId",
        allowNull: false,
      },
      onDelete: "CASCADE",
    });
    //#endregion

    //#region access
    //#region run.userViewAccess / user.runViewAccess
    /**
     * many-to-many
     * one run can have many users with view access
     * one user can have view access to many runs
     */
    Run.belongsToMany(User, {
      through: "RunUserViewAccess",
      as: "userViewAccess",
      onDelete: "CASCADE",
    });
    User.belongsToMany(Run, {
      through: "RunUserViewAccess",
      as: "runViewAccess",
      onDelete: "CASCADE",
    });
    //#endregion

    //#region run.groupViewAccess / group.runViewAccess
    /**
     * many-to-many
     * one run can have many groups with view access
     * one group can have view access to many runs
     */
    Run.belongsToMany(Group, {
      through: "RunGroupViewAccess",
      as: "groupViewAccess",
      onDelete: "CASCADE",
    });
    Group.belongsToMany(Run, {
      through: "RunGroupViewAccess",
      as: "runViewAccess",
      onDelete: "CASCADE",
    });
    //#endregion

    //#region run.userViewLogsAccess / user.runViewLogsAccess
    /**
     * many-to-many
     * one run can have many users with view logs access
     * one user can have view logs access to many runs
     */
    Run.belongsToMany(User, {
      through: "RunUserViewLogsAccess",
      as: "userViewLogsAccess",
      onDelete: "CASCADE",
    });
    User.belongsToMany(Run, {
      through: "RunUserViewLogsAccess",
      as: "runViewLogsAccess",
      onDelete: "CASCADE",
    });
    //#endregion

    //#region run.groupViewLogsAccess / group.runViewLogsAccess
    /**
     * many-to-many
     * one run can have many groups with view logs access
     * one group can have view logs access to many runs
     */
    Run.belongsToMany(Group, {
      through: "RunGroupViewLogsAccess",
      as: "groupViewLogsAccess",
      onDelete: "CASCADE",
    });
    Group.belongsToMany(Run, {
      through: "RunGroupViewLogsAccess",
      as: "runViewLogsAccess",
      onDelete: "CASCADE",
    });
    //#endregion

    //#region run.userDeleteAccess / user.runDeleteAccess
    /**
     * many-to-many
     * one run can have many users with delete access
     * one user can have delete access to many runs
     */
    Run.belongsToMany(User, {
      through: "RunUserDeleteAccess",
      as: "userDeleteAccess",
      onDelete: "CASCADE",
    });
    User.belongsToMany(Run, {
      through: "RunUserDeleteAccess",
      as: "runDeleteAccess",
      onDelete: "CASCADE",
    });
    //#endregion

    //#region run.groupDeleteAccess / group.runDeleteAccess
    /**
     * many-to-many
     * one run can have many groups with delete access
     * one group can have delete access to many runs
     */
    Run.belongsToMany(Group, {
      through: "RunGroupDeleteAccess",
      as: "groupDeleteAccess",
      onDelete: "CASCADE",
    });
    Group.belongsToMany(Run, {
      through: "RunGroupDeleteAccess",
      as: "runDeleteAccess",
      onDelete: "CASCADE",
    });
    //#endregion

    //#endregion

    this.Run = Run;
    this.Schedule = Schedule;
    this.Worker = Worker;
    this.Group = Group;
    this.User = User;
    this.Session = Session;
    this.ApiKey = ApiKey;
  }

  async updatePollInterval(pollInterval: number) {
    if (this.pollInterval === pollInterval) {
      return;
    }
    const isPolling = this.isPolling;
    if (isPolling) {
      this.stopPolling();
    }
    this.pollInterval = pollInterval;
    // create a new worker
    this.registeredWorker = undefined;
    this.workerInstance.instanceId = createShortShaHash(String(Math.random()));
    if (isPolling) {
      await this.startPolling({
        dontMigrate: true,
      });
    }
  }

  protected async getDbRuns() {
    const runs = await Run.findAll({
      order: [["createdAt", "DESC"]],
    });
    return runs;
  }
  protected async getDbSchedules(where?: WhereOptions<Schedule>) {
    /**
     * Sanitize the where clause, sequalize does not like undefined values
     */
    let sequalizeSanitizedWhere: WhereOptions<Schedule> | undefined = where
      ? { ...where }
      : undefined;

    if (sequalizeSanitizedWhere) {
      Object.entries(sequalizeSanitizedWhere).forEach(([key, value]) => {
        if (value === undefined) {
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access
          delete (sequalizeSanitizedWhere as any)[key];
        }
      });
    }
    if (
      sequalizeSanitizedWhere &&
      Object.keys(sequalizeSanitizedWhere).length === 0
    ) {
      sequalizeSanitizedWhere = undefined;
    }
    const jobs = await Schedule.findAll({
      order: [["createdAt", "DESC"]],
      where: sequalizeSanitizedWhere,
      include: [
        {
          model: Run,
          as: "lastRun",
          include: [
            {
              model: Worker,
              as: "worker",
            },
          ],
        },
      ],
    });
    return jobs;
  }

  /* eslint-disable */
  /**
   * Will get the function/handler, the latest version, and how to migrate to it
   */
  protected getLocalHandler(
    id: string,
    version: number
  ): {
    definition: JobDefinition;
    migrateData: (data?: any) => any;
    version: number;
  } {
    const versions = this.definedJobs[id];
    if (!versions) {
      throw new Error("invalid id");
    }
    let def = versions[version];
    if (!def) {
      const migrations = this.migrations[id];

      if (!migrations) {
        throw new Error("invalid version");
      }

      let migratedVersion = version;
      let migrateFn = (data?: any) => data ?? undefined;
      while (true) {
        const migration = this.migrations[id]?.[migratedVersion];
        if (migration) {
          migratedVersion = migration.targetVersion;
          migrateFn = (data?: any) => migration.migrateFn(migrateFn(data));
        } else {
          break;
        }
      }

      def = versions[migratedVersion];
      if (def) {
        return {
          definition: def,
          version: migratedVersion,
          migrateData: migrateFn,
        };
      }
    }
    if (!def) {
      throw new Error("invalid version");
    }

    return { definition: def, version, migrateData: (data) => data };
  }
  /* eslint-enable */
  public async getRuns({
    scheduleId,
    order: frontEndOrder,
    limit,
    offset,
    authHeader,
    logging,
  }: ListRunsOptions & { logging?: boolean }): Promise<{
    count: number;
    rows: PublicJobRun[];
  }> {
    const userAuth = await this.getUserAuth(authHeader);

    if (!userAuth) {
      return { count: 0, rows: [] };
    }

    const orConditions = [];

    if (!userAuth.admin) {
      if (userAuth.userId !== undefined) {
        // Condition for runs where the user has direct access
        orConditions.push({
          "$userViewAccess.id$": {
            [Op.eq]: userAuth.userId,
          },
        });
      }

      if (userAuth.groups.length > 0) {
        // Condition for runs where the user's groups have access
        orConditions.push({
          "$groupViewAccess.id$": {
            [Op.in]: userAuth.groups,
          },
        });
      }
      // If no username and no groups, return an empty array
      if (orConditions.length === 0) {
        return { count: 0, rows: [] };
      }
    }

    const where: { scheduleId?: number; [Op.or]?: typeof orConditions } = {};

    if (orConditions.length > 0) {
      where[Op.or] = orConditions;
    }

    if (typeof scheduleId === "number") {
      where.scheduleId = scheduleId;
    }

    let order: Order | undefined = frontEndOrder;
    if (frontEndOrder) {
      const getDurationSQL = () => {
        switch (this.sequelize.getDialect()) {
          case "postgres":
          case "mysql":
          case "mariadb":
            // These databases support direct date subtraction
            return this.sequelize.literal(
              `("Run"."finishedAt" - "Run"."startedAt")`
            );
          case "sqlite":
            // SQLite requires conversion to Unix timestamps
            return this.sequelize.literal(
              `(strftime('%s', "Run"."finishedAt") - strftime('%s', "Run"."startedAt"))`
            );
          case "mssql":
            // MSSQL uses DATEDIFF to calculate difference in seconds
            return this.sequelize.literal(
              `DATEDIFF(second, "Run"."startedAt", "Run"."finishedAt")`
            );
          default:
            throw new Error(
              `Unsupported dialect: ${this.sequelize.getDialect()}`
            );
        }
      };
      order = frontEndOrder.map((o) => {
        if (o[0] === "duration") {
          return [getDurationSQL(), o[1]];
        }
        return o;
      });
    }

    const { count, rows } = await Run.findAndCountAll({
      logging: logging ? console.log : undefined,
      include: [
        {
          model: Schedule,
          as: "schedule",
          include: [
            {
              model: Run,
              as: "lastRun",
              include: [
                {
                  model: Worker,
                  as: "worker",
                },
              ],
            },
          ],
        },
        { model: Worker, as: "worker" },
        {
          model: User,
          as: "userViewAccess",
          attributes: ["id"],
          through: { attributes: [] },
        },
        {
          model: Group,
          as: "groupViewAccess",
          attributes: ["id"],
          through: { attributes: [] },
        },
      ],
      where,
      limit: limit ?? 25,
      order,
      subQuery: false,
      offset: offset ?? 0,
    });

    const workers = await this.getWorkers(authHeader);

    const runs = rows.map((run) => {
      const jobSchedule = run.schedule;
      return createPublicJobRun(
        run,
        jobSchedule ?? run.scheduleTitle,
        this.getHandler(run.functionId, run.functionVersion, workers)
      );
    });

    return {
      count,
      rows: runs,
    };
  }
  public async getRun(
    authHeader: z.output<typeof AuthHeader>,
    runId: number
  ): Promise<PublicJobRun> {
    const run = await Run.findByPk(runId, {
      include: [
        {
          model: Worker,
          as: "worker",
        },
      ],
    });
    if (!run) {
      throw new Error("invalid runId");
    }
    const schedule = await run.getSchedule({
      include: [
        {
          model: Run,
          as: "lastRun",
        },
      ],
    });
    return createPublicJobRun(
      run,
      schedule ?? run.scheduleTitle,
      this.getHandler(
        run.functionId,
        run.functionVersion,
        await this.getWorkers(authHeader)
      )
    );
  }

  public async reset(
    authHeader: z.output<typeof AuthHeader>
  ): Promise<boolean> {
    const auth = await this.getUserAuth(authHeader);
    if (!auth?.admin) {
      return false;
    }
    await Run.truncate({
      cascade: true,
    });
    await Schedule.truncate({
      cascade: true,
    });
    this.registeredWorker = undefined;
    await Worker.truncate({
      cascade: true,
    });
    await this.registerWorker();
    return true;
  }

  public async deleteRun(
    authHeader: z.output<typeof AuthHeader>,
    runId: number
  ): Promise<PublicJobRun> {
    const run = await Run.findByPk(runId);
    if (!run) {
      throw new Error("invalid runId");
    }
    const publicRun = await this.getRun(authHeader, runId);

    await run.destroy({
      logging: console.log,
    });

    return publicRun;
  }
  public async deleteRuns(runIds: number[]): Promise<number[]> {
    await Run.destroy({
      where: {
        id: runIds,
      },
    });
    return runIds;
  }
  public async getSchedule(
    authHeader: z.output<typeof AuthHeader>,
    id: number
  ): Promise<PublicJobSchedule | undefined> {
    const schedule = await Schedule.findByPk(id, {
      include: [
        {
          model: Run,
          as: "lastRun",
          include: [
            {
              model: Worker,
              as: "worker",
            },
          ],
        },
      ],
    });
    if (!schedule) {
      return;
    }
    const handler = this.getHandler(
      schedule.functionId,
      schedule.functionVersion,
      await this.getWorkers(authHeader)
    );
    return createPublicJobSchedule(schedule, handler);
  }

  private getHandler(
    functionId: string,
    version: number,
    workers: PublicWorker[]
  ): string | PublicJobDefinition {
    const onServerHandler = this.definedJobs[functionId]?.[version];
    if (onServerHandler) {
      return createPublicJobDefinition(onServerHandler);
    }
    const workersThatAreUp = workers.filter((worker) => {
      // prioritize workers that are up
      return worker.status === WorkerStatus.UP;
    });
    for (const worker of [...workersThatAreUp, ...workers]) {
      const handler = worker.definitions.find((def) => {
        return def.id === functionId && def.version === version;
      });
      if (handler) {
        return handler;
      }
    }
    return `${functionId} v${version}`;
  }

  public async getLatestHandler(
    functionId: string,
    authHeader: z.output<typeof AuthHeader>
  ): Promise<PublicJobDefinition> {
    const handlers = await this.getLatestHandlers(authHeader);
    const handler = handlers.find((h) => h.id === functionId);
    if (!handler) {
      throw new Error("invalid functionId or the worker is not online");
    }
    return handler;
  }

  private canView(
    user: z.output<typeof UserAuthSchema>,
    access?: { users?: number[]; groups?: number[] }
  ) {
    if (!access) {
      return false;
    }
    if (user.admin) {
      return true;
    }
    if (user.userId) {
      if (access.users?.includes(user.userId)) {
        return true;
      }
    }
    if (user.groups.length > 0) {
      if (access.groups?.some((group) => user.groups.includes(group))) {
        return true;
      }
    }
    return false;
  }

  public canViewWorker(
    user: z.output<typeof UserAuthSchema>,
    worker: Worker
  ): boolean {
    if (user.admin) {
      return true;
    }
    return this.canView(user, worker.access?.view);
  }

  public canViewFunction(
    user: z.output<typeof UserAuthSchema>,
    fn: PublicJobDefinition
  ): boolean {
    if (user.admin) {
      return true;
    }
    if (this.canView(user, fn.access?.view)) {
      return true;
    }
    return false;
  }

  public canViewSchedule(
    user: z.output<typeof UserAuthSchema>,
    schedule: Schedule
  ): boolean {
    if (user.admin) {
      return true;
    }
    return this.canView(user, schedule.access?.view);
  }

  public async getUserAuth(
    authHeader: z.output<typeof AuthHeader>
  ): Promise<z.output<typeof UserAuthSchema> | undefined> {
    const [type, token] = z
      .tuple([
        z.union([
          z.literal("Jwt"),
          z.literal("Api-Key"),
          z.literal("User-Api-Key"),
        ]),
        z.string(),
      ])
      .parse(authHeader.split(" "));

    if (type === "Jwt") {
      try {
        const decoded = await new Promise<{ userId: number }>(
          (resolve, reject) => {
            jwt.verify(token, this.accessTokenSecret, (err, d) => {
              if (err) {
                reject(err);
              }
              resolve(z.object({ userId: z.number() }).parse(d));
            });
          }
        );
        const userId = decoded.userId;
        const user = await this.User.findByPk(userId, {
          include: [
            {
              model: Group,
              as: "groups",
            },
          ],
        });
        if (user) {
          return {
            admin: user.admin,
            groups: (user.groups ?? []).map((group) => group.id),
            userId: user.id,
          };
        }
      } catch (error) {
        return undefined;
      }
    }
    if (type === "Api-Key") {
      if (token === this.apiKey) {
        return {
          admin: true,
          groups: [],
        };
      }
    }
    if (type === "User-Api-Key") {
      const apiKey = await this.ApiKey.findOne({
        where: {
          key: token,
        },
        include: [
          {
            model: User,
            as: "user",
            include: [
              {
                model: Group,
                as: "groups",
              },
            ],
          },
        ],
      });
      if (apiKey) {
        return {
          admin: apiKey.user.admin,
          groups: (apiKey.user.groups ?? []).map((group) => group.id),
          userId: apiKey.user.id,
        };
      }
    }
    throw new Error("invalid auth header");
  }

  public async getLatestHandlers(
    authHeader: z.output<typeof AuthHeader>
  ): Promise<PublicJobDefinition[]> {
    const handlerMap: Record<
      string,
      { def: PublicJobDefinition; version: number } | undefined
    > = {};
    const upWorkers = (await this.getWorkers(authHeader)).filter((worker) => {
      return worker.status === WorkerStatus.UP;
    });

    const userAccess = await this.getUserAuth(authHeader);

    if (!userAccess) {
      return [];
    }

    upWorkers.forEach((worker) => {
      worker.definitions.forEach((def: PublicJobDefinition) => {
        if (!this.canViewFunction(userAccess, def)) {
          return;
        }
        const latest = { def, version: def.version };
        const current = handlerMap[def.id] || latest;
        if (def.id === current.def.id && def.version > current.version) {
          current.version = def.version;
          current.def = def;
        }
        handlerMap[def.id] = current;
      });
    });
    return Object.values(handlerMap).flatMap((val) => (val ? [val.def] : []));
  }
  private getPublicHandlers(): PublicJobDefinition[] {
    return Object.values(this.definedJobs)
      .map((versions) => {
        if (!versions) {
          return [];
        }
        const versionList = Object.keys(versions).sort(
          (a, b) => Number(b) - Number(a)
        );
        const latestVersion = versionList[0];
        return versions[latestVersion];
      })
      .filter((value): value is JobDefinition => Boolean(value))
      .map((def) => createPublicJobDefinition(def));
  }

  public async getSchedules(
    authHeader: z.output<typeof AuthHeader>,
    filters?: z.output<typeof SchedulesFilterSchema>
  ): Promise<PublicJobSchedule[]> {
    const dbSchedules = await this.getDbSchedules(filters);
    const workers = await this.getWorkers(authHeader);
    return Promise.all(
      dbSchedules.map((schedule) => {
        return createPublicJobSchedule(
          schedule,
          this.getHandler(
            schedule.functionId,
            schedule.functionVersion,
            workers
          )
        );
      })
    );
  }

  public async deleteWorkers(workerIds: number[]): Promise<number[]> {
    await Worker.destroy({
      where: {
        id: workerIds,
      },
    });
    if (this.registeredWorker) {
      if (workerIds.includes(this.registeredWorker.id)) {
        this.registeredWorker = undefined;
      }
    }
    return workerIds;
  }

  protected registeredWorker: Worker | undefined;

  public async registerWorker(attempt = 0): Promise<Worker> {
    log(`Registering this worker (attempt: ${attempt})`);
    try {
      if (this.registeredWorker) {
        try {
          const worker = this.registeredWorker;
          await worker.reload();
          worker.lastReached = new Date();
          await worker.save();

          return this.registeredWorker;
        } catch (err) {
          this.registeredWorker = undefined;
        }
      }
      return this.sequelize.transaction(async (transaction) => {
        // As a user I have 3 server running.
        // Each server runs a worker with the same workerId.
        // I update the worker on one server.
        // That worker will get a new hash.
        // Therefore when comparing that worker to the other workers it will be different.
        // Therefore the version will be incremented.

        const workers = await this.Worker.findAll({
          where: { workerId: this.workerInstance.workerId },
          transaction,
        });

        let version = 1;
        const hashes = new Set<string>();
        workers.forEach((worker) => {
          version = Math.max(worker.version, version);
          hashes.add(createWorkerHash(worker));
        });

        const thisWorkerHash = createWorkerHash({
          title: this.workerInstance.title,
          description: this.workerInstance.description,
          pollInterval: this.pollInterval,
          definitions: this.getPublicHandlers(),
          defaultFunctionAccess: this.defaultFunctionAccess,
          defaultScheduleAccess: this.defaultScheduleAccess,
          defaultRunAccess: this.defaultRunAccess,
        });

        if (hashes.size > 0 && !hashes.has(thisWorkerHash)) {
          version += 1;
        }

        const [worker] = await this.Worker.findOrCreate({
          lock: true,
          where: {
            workerId: this.workerInstance.workerId,
            // instance id is random, so every time the server is booted up and new worker is created
            instanceId: this.workerInstance.instanceId,
          },
          defaults: {
            workerId: this.workerInstance.workerId,
            instanceId: this.workerInstance.instanceId,
            version,
            definitions: this.getPublicHandlers(),
            description: this.workerInstance.description,
            lastReached: new Date(),
            title: this.workerInstance.title,
            hostname: os.hostname(),
            pollInterval: this.pollInterval,
            defaultFunctionAccess: this.defaultFunctionAccess,
            defaultScheduleAccess: this.defaultScheduleAccess,
            defaultRunAccess: this.defaultRunAccess,
          },
          transaction,
        });
        worker.version = version;
        worker.lastReached = new Date();
        this.registeredWorker = worker;
        await worker.save({ transaction });
        return worker;
      });

      // If the execution reaches this line, the transaction has been committed successfully
      // `result` is whatever was returned from the transaction callback (the `user`, in this case)
    } catch (error) {
      // there are sometimes deadlocks, so we retry
      const MAX_ATTEMPTS = 10;
      if (attempt >= MAX_ATTEMPTS) {
        console.log(`Failed to register worker after ${MAX_ATTEMPTS} attempts`);
        throw error;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, Math.min(attempt * 1000, 5000));
      });
      return this.registerWorker(attempt + 1);
      // If the execution reaches this line, an error occurred.
      // The transaction has already been rolled back automatically by Sequelize!
      // try again
    }
  }

  protected createSignature(
    functionId: string,
    runAt: Date | undefined,
    data: unknown,
    cronExpression: string | undefined
  ): string {
    const rounded = cronExpression
      ? "cron-expression"
      : runAt
      ? Math.floor(runAt.getTime() / 1000) * 1000
      : "manual";
    let signature = `${functionId}-${rounded}-${JSON.stringify(data)}`;
    if (cronExpression) {
      signature += `-${parseExpression(cronExpression).stringify(true)}`;
    }
    return signature;
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
    let migratedVersion = functionVersion;
    let migratedData = data;
    while (true) {
      const migration = this.migrations[functionId]?.[migratedVersion];
      if (migration) {
        migratedVersion = migration.targetVersion;
        migratedData = migration.migrateFn(migratedData);
      } else {
        break;
      }
    }

    const {
      cronExpression,
      eventId,
      runAt,
      retryFailedJobs = false,
      maxRetries = -1,
      failureTrigger,
      workerId,
      defaultRunAccess,
      access,
      runNow,
    } = options;
    const signature = this.createSignature(
      functionId,
      runAt,
      migratedData,
      cronExpression
    );
    const where: WhereOptions<ScheduleAttributes> = eventId
      ? {
          eventId,
          // claimed: false, // when we have eventId then I as a user say that I only want one schedule to exist in the system with this eventId
        }
      : {
          signature,
          claimed: false, // maybe we want to re-schedule a one-time job that has been scheduled before, preferbly just run the schedule again though
        };
    // normalize the cron expression
    const normalizedCronExpression = cronExpression
      ? parseExpression(cronExpression).stringify(true)
      : undefined;

    const serializedData = migratedData
      ? JSON.stringify(migratedData)
      : undefined;
    const defaults: Optional<
      InferCreationAttributes<Schedule>,
      | "id"
      | "runNow"
      | "createdAt"
      | "claimId"
      | "retries"
      | "claimed"
      | "numRuns"
    > = {
      functionVersion: migratedVersion,
      retryFailedJobs,
      workerId,
      maxRetries,
      functionId,
      cronExpression: normalizedCronExpression,
      runAt,
      data: serializedData ?? null,
      signature,
      title,
      description,
      failureTriggerId: failureTrigger,
      defaultRunAccess,
      access,
      runNow: runNow ?? false,
    };
    const result = await Schedule.findOrCreate({
      where,
      defaults,
      include: [
        {
          model: Run,
          as: "lastRun",
          include: [
            {
              model: Worker,
              as: "worker",
            },
          ],
        },
      ],
    });
    let status: "created" | "updated" | "unchanged" = "unchanged";
    const [schedule, created] = result;
    if (created) {
      status = "created";
    }
    // to support the enschedule apply, we want to update the schedule if it already exists
    if (!created && eventId) {
      /* eslint-disable */
      // update the schedule
      let updated = false;
      const updatedDebug: Record<string, [unknown, unknown]> = {};

      Object.keys(defaults).forEach((_key) => {
        const key = _key as keyof typeof defaults;

        const value = defaults[key] as any;

        const prev = schedule[key];

        if (key === "runAt") {
          // because we are comparing date objects
          if (String(prev) === String(value)) {
            return;
          }
        }

        // sequelize returns null for undefined values
        if (prev == value) {
          return;
        }

        if (prev !== value) {
          (schedule as Record<string, any>)[key] = value;
          updated = true;
          updatedDebug[key] = [prev, value];
        }
      });

      if (updated) {
        status = "updated";
        log(`Updating schedule (${schedule.id})`, updatedDebug);
      }
      /* eslint-enable */

      await schedule.save();
    }

    return [schedule, status] as const;
  }

  public async scheduleJob(
    authHeader: z.output<typeof AuthHeader>,
    functionId: string,
    functionVersion: number,
    data: unknown,
    options: ScheduleJobOptions
  ): Promise<ScheduleJobResult>;
  public async scheduleJob<T extends ZodType = ZodType>(
    authHeader: z.output<typeof AuthHeader>,
    job: JobDefinition<T>,
    functionVersion: number,
    data: z.infer<T>,
    options: ScheduleJobOptions
  ): Promise<ScheduleJobResult>;
  public async scheduleJob(
    authHeader: z.output<typeof AuthHeader>,
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    def: string | JobDefinition<any>,
    functionVersion: number,
    data: unknown,
    options: ScheduleJobOptions
  ): Promise<ScheduleJobResult> {
    const functionId = typeof def === "string" ? def : def.id;

    let runAt: Date | undefined = options.runAt;
    const cronExpression: string | undefined = options.cronExpression;

    if (cronExpression) {
      runAt = parseExpression(cronExpression).next().toDate();
    }

    const { retryFailedJobs, maxRetries, failureTrigger } = options;

    const [dbSchedule, status] = await this.createJobSchedule({
      functionId,
      title: options.title,
      description: options.description,
      functionVersion,
      data: data ?? null,
      options: {
        eventId: options.eventId,
        runAt,
        cronExpression,
        retryFailedJobs,
        maxRetries,
        failureTrigger,
        defaultRunAccess: options.defaultRunAccess,
        access: options.access,
        workerId: options.workerId,
        runNow: options.runNow,
      },
    });
    return {
      schedule: createPublicJobSchedule(
        dbSchedule,
        this.getHandler(
          dbSchedule.functionId,
          dbSchedule.functionVersion,
          await this.getWorkers(authHeader)
        )
      ),
      status,
    };
  }

  public async runScheduleNow(scheduleId: number) {
    log(`Will mark schedule (${scheduleId}) as "run now"`);
    const schedule = await Schedule.findByPk(scheduleId, {
      include: [
        {
          model: Run,
          as: "lastRun",
          include: [
            {
              model: Worker,
              as: "worker",
            },
          ],
        },
      ],
    });
    if (!schedule) {
      throw new Error("invalid scheduleId");
    }
    schedule.runNow = true;
    schedule.claimed = false;
    await schedule.save();
    log(`Marked schedule (${scheduleId}) as "run now"`);
  }

  public async runSchedulesNow(scheduleIds: number[]) {
    const result = await Schedule.update(
      {
        runNow: true,
        claimed: false,
      },
      {
        returning: true,
        where: {
          id: {
            [Op.in]: scheduleIds,
          },
        },
      }
    );

    return result;
  }

  public async unschedule(scheduleIds: number[]) {
    const result = await Schedule.update(
      {
        runAt: null,
        claimed: false,
        runNow: false,
      },
      {
        where: {
          id: {
            [Op.in]: scheduleIds,
          },
        },
      }
    );
    return result;
  }

  protected async claimUnclaimedOverdueJobs() {
    // only fetch jobs for a server that has a job definition for the schedule functionId
    const jobKeys = Object.keys(this.definedJobs);
    if (jobKeys.length === 0) {
      return [];
    }
    const claimId = createShortShaHash(String(Math.random()));
    await Schedule.update(
      {
        claimed: true,
        runNow: false,
        claimId,
      },
      {
        limit: this.maxJobsPerTick,
        where: {
          [Op.and]: [
            {
              // this worker must have the handler for this schedule
              [Op.or]: jobKeys.flatMap((key) => {
                const definedJobs = this.definedJobs[key];
                if (definedJobs) {
                  const eligibleVersions = new Set(Object.keys(definedJobs));
                  const migrations = { ...this.migrations[key] };
                  eligibleVersions.forEach((version) => {
                    delete migrations[version];
                  });
                  // if we can migrate from a -> b -> c and c is in the eligible versions, then b will be added as well to the eligible versions followed by a being added.
                  while (Object.keys(migrations).length > 0) {
                    let didAction = false;
                    Object.entries(migrations).forEach(
                      ([fromVersion, migration]) => {
                        if (!migration) {
                          return;
                        }
                        if (
                          eligibleVersions.has(String(migration.targetVersion))
                        ) {
                          delete migrations[fromVersion];
                          eligibleVersions.add(fromVersion);
                          didAction = true;
                        }
                      }
                    );
                    if (!didAction) {
                      break;
                    }
                  }
                  return [
                    {
                      functionId: key,
                      functionVersion: {
                        [Op.in]: Array.from(eligibleVersions).map(Number),
                      },
                    },
                  ];
                }
                return [];
              }),

              // it must not already be claimed by another worker
              claimed: {
                [Op.eq]: false,
              },
            },
            {
              [Op.or]: [
                {
                  // its runAt must be in the past
                  runAt: {
                    [Op.lte]: new Date(),
                  },
                },
                {
                  // or it is maked as "run now", using any of the schedule run now buttons
                  runNow: {
                    [Op.eq]: true,
                  },
                },
              ],
            },
            {
              [Op.or]: [
                // optional, a user can say a schedule must run on a worker with a specific workerId
                {
                  // only run scheules marked for any worker
                  workerId: {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    [Op.eq]: null!,
                  },
                },
                {
                  // only run scheules marked for this worker
                  workerId: {
                    [Op.eq]: this.workerInstance.workerId,
                  },
                },
              ],
            },
          ],
        },
      }
    );

    return Schedule.findAll({ where: { claimId } });
  }

  protected definedJobs: Record<
    string,
    undefined | Record<string, undefined | JobDefinition>
  > = {};

  public registerJob<T extends ZodType = ZodType>(job: JobDefinition<T>) {
    JobDefinitionSchema.parse(job);
    const id = job.id;
    if (!this.definedJobs[id]) {
      this.definedJobs[id] = {};
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-non-null-assertion
    this.definedJobs[id]![job.version] = job as JobDefinition<any>;

    job.access = this.mergeFunctionAccess(
      this.defaultFunctionAccess,
      job.access
    );
    job.defaultScheduleAccess = this.mergeScheduleAccess(
      // merge worker defaultScheduleAccess with function defaultScheduleAccess
      this.defaultScheduleAccess,
      job.defaultScheduleAccess
    );
    job.defaultRunAccess = this.mergeRunAccess(
      // merge worker defaultRunAccess with function defaultRunAccess
      this.defaultRunAccess,
      job.defaultRunAccess
    );
    return job;
  }

  private mergeFunctionAccess(
    parent: FunctionAccess | undefined,
    child: FunctionAccess | undefined
  ) {
    return this.mergeAccess(parent, child, ["view", "createSchedule"]);
  }

  private mergeScheduleAccess(
    parent: ScheduleAccess | undefined,
    child: ScheduleAccess | undefined
  ) {
    return this.mergeAccess(parent, child, ["view", "edit", "delete"]);
  }

  private mergeRunAccess(
    parent: RunAccess | undefined,
    child: RunAccess | undefined
  ) {
    return this.mergeAccess(parent, child, ["view", "viewLogs", "delete"]);
  }

  private mergeAccess<T extends Record<string, Access | undefined>>(
    parent: T | undefined,
    child: T | undefined,
    keys: (keyof T)[]
  ): Partial<Record<keyof T, Access | undefined>> | undefined {
    const mergeOne = (a?: Access, b?: Access): Access | undefined => {
      const newAccess: Access = {
        users: [...(a?.users ?? []), ...(b?.users ?? [])],
        groups: [...(a?.groups ?? []), ...(b?.groups ?? [])],
      };
      if (newAccess.users?.length === 0) {
        delete newAccess.users;
      }
      if (newAccess.groups?.length === 0) {
        delete newAccess.groups;
      }
      if (!newAccess.users && !newAccess.groups) {
        return undefined;
      }
      return newAccess;
    };
    const newRunAccess: Partial<Record<keyof T, Access | undefined>> = {};
    let hasKey = false;
    for (const key of keys) {
      const newVal = mergeOne(parent?.[key], child?.[key]);
      if (newVal) {
        newRunAccess[key] = newVal;
        hasKey = true;
      }
    }
    if (!hasKey) {
      return undefined;
    }
    return newRunAccess;
  }

  /**
   * e.g. `{ "functionId": { "1": { targetVersion: 2, migrateFn: (data) => data } }`
   */
  private migrations: Record<
    string,
    | undefined
    | Record<
        string,
        | undefined
        | {
            targetVersion: number;
            migrateFn: (data: unknown) => unknown;
          }
      >
  > = {};

  public async migrateHandler<T extends ZodType, U extends ZodType>(
    id: string,
    from: Pick<JobDefinition<T>, "dataSchema" | "version">,
    to: Omit<JobDefinition<U>, "id">,
    migrateFn: (a: z.infer<T>) => z.infer<U>
  ) {
    /* eslint-disable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */
    if (
      ((from as any).id && (from as any).id !== id) ||
      ((to as any).id && (to as any).id !== id)
    ) {
      throw new Error("The definition ids must be the same");
    }
    /* eslint-enable @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-explicit-any */

    const job = this.registerJob({ ...to, id });

    const migrations = this.migrations[id] ?? {};
    migrations[from.version] = {
      targetVersion: to.version,
      migrateFn,
    };
    this.migrations[id] = migrations;

    const newSchedules = await Schedule.findAll({
      order: [["createdAt", "DESC"]],
      include: {
        model: Run,
        as: "lastRun",
      },
      where: {
        [Op.and]: [
          {
            functionId: id,
          },
          {
            functionVersion: from.version,
          },
        ],
      },
    });

    await Promise.all(
      newSchedules.map(async (schedule) => {
        let newData: z.TypeOf<U> | undefined;
        if (from.dataSchema && schedule.data) {
          const data = from.dataSchema.parse(
            JSON.parse(schedule.data)
          ) as z.infer<T>;
          newData = to.dataSchema
            ? (to.dataSchema.parse(migrateFn(data)) as z.infer<U>)
            : undefined;
        } else if (to.dataSchema) {
          newData = to.dataSchema.parse(
            schedule.data
              ? migrateFn(JSON.parse(schedule.data) as z.infer<T>)
              : undefined
          ) as z.infer<U>;
        }
        schedule.data = newData ? JSON.stringify(newData) : undefined;
        schedule.functionVersion = to.version;
        await schedule.save();
      })
    );
    return job;
  }

  public async getWorkers(
    authHeader: z.output<typeof AuthHeader>,
    where?: WhereOptions<
      InferAttributes<
        Worker,
        {
          omit: "lastRun" | "runs";
        }
      >
    >
  ): Promise<z.output<typeof PublicWorkerSchema>[]> {
    const userAuth = await this.getUserAuth(authHeader);
    if (!userAuth) {
      return [];
    }

    const allWorkers = await this.Worker.findAll({
      where,
      include: [
        {
          model: Run,
          as: "lastRun",
        },
        {
          model: Run,
          as: "runs",
        },
      ],
    });
    return allWorkers
      .filter((worker) => this.canViewWorker(userAuth, worker))
      .map(createPublicWorker);
  }

  private driverVersion = 1;

  public async migrateDatabase() {
    log(
      `Migrating the database using the (${databaseMigrations.length}) saved migrations`
    );

    const migrate = async () => {
      const umzug = new Umzug({
        migrations: databaseMigrations,
        context: this.sequelize.getQueryInterface(),
        storage: new SequelizeStorage({
          sequelize: this.sequelize,
        }),
        logger: {
          info: log,
          error: log,
          warn: log,
          debug: log,
        },
      });

      await umzug.up();
    };

    const migrateMeta = async () => {
      const umzug = new Umzug({
        migrations: [
          {
            name: "00000-meta-initial",
            up: async ({ context: queryInterface }) => {
              return queryInterface.sequelize.transaction(
                async (transaction) => {
                  await queryInterface.createTable(
                    "EnscheduleMeta",
                    {
                      id: {
                        type: DataTypes.INTEGER,
                        autoIncrement: true,
                        primaryKey: true,
                        allowNull: false,
                      },
                      driverVersion: {
                        type: DataTypes.INTEGER,
                        allowNull: false,
                      },
                      enscheduleVersion: {
                        type: DataTypes.STRING,
                        allowNull: false,
                      },
                      createdAt: {
                        type: DataTypes.DATE,
                        allowNull: false,
                      },
                      updatedAt: {
                        type: DataTypes.DATE,
                        allowNull: false,
                      },
                    },
                    { transaction }
                  );
                }
              );
            },

            down: async ({ context: queryInterface }) => {
              return queryInterface.sequelize.transaction(
                async (transaction) => {
                  await queryInterface.dropTable("EnscheduleMeta", {
                    transaction,
                  });
                }
              );
            },
          },
        ],
        context: this.sequelize.getQueryInterface(),
        storage: new SequelizeStorage({
          sequelize: this.sequelize,
          modelName: "EnscheduleMetaMigrations",
        }),
        logger: {
          info: log,
          error: log,
          warn: log,
          debug: log,
        },
      });

      await umzug.up();
    };

    let versionRow: EnscheduleMeta | null = null;
    try {
      versionRow = await EnscheduleMeta.findByPk(1);
    } catch (err) {
      // has not migrated the database yet
      await migrateMeta();
    }
    if (!versionRow) {
      versionRow = await EnscheduleMeta.create({
        id: 1,
        driverVersion: this.driverVersion,
        enscheduleVersion: packageVersion,
      });
    }

    const dbDriverVersion = versionRow.driverVersion;
    const dbEnscheduleVer = versionRow.enscheduleVersion;

    // the database has been migrated using a newer version of the worker. Therefore this worker will not work.
    if (dbDriverVersion > this.driverVersion) {
      throw new Error(
        `This worker is outdated, please update to ${dbEnscheduleVer}`
      );
    }
    // if (this.driverVersion >= dbDriverVersion) { // implied
    await migrate();
    versionRow.driverVersion = this.driverVersion;
    versionRow.enscheduleVersion = packageVersion;
    await versionRow.save();
    // }

    if (process.env.ADMIN_ACCOUNT) {
      const result = z
        .tuple([z.string(), z.string()])
        .safeParse(process.env.ADMIN_ACCOUNT.split(":"));
      if (result.success) {
        const [username, password] = result.data;
        await this.register({
          admin: true,
          name: "Admin",
          username,
          password,
        });
      } else {
        throw new Error(
          `Invalid value for environment variable "ADMIN_ACCOUNT". It must be assigned a string in the format "username:password".`
        );
      }
    }
  }

  pollingStartTimerId: NodeJS.Timeout | undefined;
  pollingIntervalId: NodeJS.Timeout | undefined;
  isPolling = false;

  public async startPolling(
    { dontMigrate = false }: { dontMigrate?: boolean } = {
      dontMigrate: false,
    }
  ) {
    this.isPolling = true;
    if (!dontMigrate && this.isPolling) {
      await this.migrateDatabase();
    }
    if (!this.isPolling) {
      // async check
      return;
    }
    await this.checkVersion();
    await this.registerWorker();
    log("Polling the database for jobs");
    const now = Date.now();
    this.pollingStartTimerId = setTimeout(() => {
      this.pollingIntervalId = setInterval(() => {
        log("Tick", String(new Date()));
        void this.tick();
      }, this.pollInterval * 1000);
    }, 1000 - (now - Math.floor(now / 1000) * 1000));
  }

  public stopPolling() {
    this.isPolling = false;
    if (this.pollingStartTimerId) {
      clearTimeout(this.pollingStartTimerId);
    }
    if (this.pollingIntervalId) {
      clearInterval(this.pollingIntervalId);
    }
  }

  private async checkVersion() {
    const versionRow = await EnscheduleMeta.findByPk(1);
    if (!versionRow) {
      throw new Error("Database not migrated");
    }
    if (versionRow.driverVersion !== this.driverVersion) {
      if (versionRow.driverVersion > this.driverVersion) {
        throw new Error(
          `This worker is outdated, please update this worker to the following version: ${versionRow.enscheduleVersion}`
        );
      } else {
        throw new Error(
          `The database was migrated using a worker of version ${versionRow.enscheduleVersion} while this worker is of version ${packageVersion}. Please migrate the database`
        );
      }
    }
  }

  protected async tick() {
    await this.checkVersion();
    await this.registerWorker();
    await this.runOverdueJobs();
  }

  /**
   * Will run a scheduele directly
   */
  protected async runSchedule(
    authHeader: z.output<typeof AuthHeader>,
    scheduleId: number
  ) {
    const schedule = await Schedule.findByPk(scheduleId, {
      include: [
        {
          model: Run,
          as: "lastRun",
          include: [
            {
              model: Worker,
              as: "worker",
            },
          ],
        },
      ],
    });
    if (!schedule) {
      throw new Error("invalid scheduleId");
    }
    const run = await this.scheduleSingleRun(schedule);
    await schedule.reload({
      include: {
        model: Run,
        as: "lastRun",
      },
    });
    return createPublicJobRun(
      run,
      schedule,
      this.getHandler(
        schedule.functionId,
        schedule.functionVersion,
        await this.getWorkers(authHeader)
      )
    );
  }

  /**
   * When updating the schedule from the schedule details page with the update button (this is the modal)
   */
  public async updateSchedule(
    authHeader: z.output<typeof AuthHeader>,
    updatePayload: z.output<typeof ScheduleUpdatePayloadSchema>
  ) {
    const schedule = await Schedule.findByPk(updatePayload.id, {
      include: [
        {
          model: Run,
          as: "lastRun",
          include: [
            {
              model: Worker,
              as: "worker",
            },
          ],
        },
      ],
    });
    if (!schedule) {
      throw new Error("invalid id in ScheduleUpdatePayload");
    }
    if (typeof updatePayload.description !== "undefined") {
      schedule.description = updatePayload.description;
    }
    if (typeof updatePayload.title !== "undefined") {
      schedule.title = updatePayload.title;
    }
    if (typeof updatePayload.data !== "undefined") {
      schedule.data = updatePayload.data;
    }
    if (updatePayload.runAt === null) {
      // if we have a job that is repeating on failure, this is the escape hatch to stop it
      schedule.runAt = null;
      schedule.claimed = true;
    } else if (updatePayload.runAt instanceof Date) {
      schedule.runAt = updatePayload.runAt;
      schedule.claimed = false;
    }
    if (typeof updatePayload.runNow === "boolean") {
      schedule.runNow = updatePayload.runNow;
    }
    if (typeof updatePayload.retryFailedJobs === "boolean") {
      schedule.retryFailedJobs = updatePayload.retryFailedJobs;
    }
    if (typeof updatePayload.maxRetries === "number") {
      schedule.maxRetries = updatePayload.maxRetries;
    }
    await schedule.save();
    return createPublicJobSchedule(
      schedule,
      this.getHandler(
        schedule.functionId,
        schedule.functionVersion,
        await this.getWorkers(authHeader)
      )
    );
  }

  private async runDbSchedule(schedule: Schedule, run: Run) {
    const definition = this.getLocalHandler(
      schedule.functionId,
      schedule.functionVersion
    );
    const data: unknown = definition.migrateData(
      schedule.data ? JSON.parse(schedule.data) : undefined
    );
    return this.runDefinition(
      {
        functionId: schedule.functionId,
        migratedData: data,
        version: definition.version,
      },
      run
    );
  }

  public async runDefinition(runMessage: RunHandlerInCp, run: Run) {
    const stdoutStream = new stream.PassThrough();
    const stderrStream = new stream.PassThrough();

    function getHighPrecisionISOString() {
      const isoString = new Date().toJSON().replace(/\..*/, "");
      const [, nanoseconds] = process.hrtime();
      const highPrecisionString = `${isoString}.${String(nanoseconds)
        .padStart(7, "0")
        .slice(0, 7)}Z`;
      return highPrecisionString;
    }

    const combinedStream = new stream.PassThrough();
    stdoutStream.pipe(combinedStream);
    stderrStream.pipe(combinedStream);

    let rowCount = 0;
    let fileSize = 0;

    let saveOutput = false;

    const nfs = await this.getNafs();

    const logFile = `/${run.id}-${new Date().toISOString()}.log`;

    let logStream: stream.Writable | undefined;
    try {
      logStream = nfs.createWriteStream(logFile);
      run.logFile = logFile;
      await run.save();
    } catch (err) {
      log("Error creating log file", err);
    }

    if (logStream) {
      const ls = logStream;
      const rl = readline.createInterface({ input: combinedStream });
      rl.on("line", (line) => {
        if (!saveOutput) {
          return;
        }
        const timestamp = getHighPrecisionISOString();
        const logLine = `${timestamp} ${line}\n`;
        ls.write(logLine);
        fileSize += Buffer.byteLength(logLine, "utf8");
        rowCount += 1;
      });
    }

    const awaitStream = (pipeStream: stream.PassThrough) => {
      let _resolve: undefined | (() => void);
      let resolved = false;
      pipeStream.on("finish", () => {
        if (_resolve) {
          _resolve();
          resolved = true;
        }
      });
      // in case the finish event is emitted synchronously
      if (resolved) {
        return Promise.resolve();
      }
      return new Promise<void>((resolve) => {
        _resolve = resolve;
      });
    };

    const toggleSaveOutput = (newSaveOutput: boolean) => {
      saveOutput = newSaveOutput;
    };

    const promise = awaitStream(combinedStream);

    if (this.logJobs) {
      stdoutStream.pipe(process.stdout, { end: false });
      stderrStream.pipe(process.stderr, { end: false });
    }

    const streamHandle: StreamHandle = {
      stdout: stdoutStream,
      stderr: stderrStream,
      toggleSaveOutput,
    };

    const _console = this.createConsole(stdoutStream, stderrStream);

    let exitSignal = "0";
    try {
      log("Creating a worker process to run", runMessage.functionId);
      exitSignal = await this.fork(runMessage, streamHandle);
    } catch (err) {
      _console.error(err);
      exitSignal = "1";
    }
    stdoutStream.end();
    stderrStream.end();

    await promise;
    if (logStream) {
      logStream.end();
    }
    const finishedAt = new Date();

    run.exitSignal = exitSignal;
    run.finishedAt = finishedAt;
    if (logStream) {
      run.logFileRowCount = rowCount;
      run.logFileSize = fileSize;
    }

    await run.save();

    return { exitSignal, finishedAt };
  }

  public async streamLogs(
    authHeader: z.output<typeof AuthHeader>,
    runId: number
  ): Promise<Readable | undefined> {
    try {
      const nfs = await this.getNafs();
      const run = await Run.findByPk(runId);
      if (run?.logFile) {
        const s = nfs.createReadStream(run.logFile);
        s.on("error", (err) => {
          log("Error reading log file", String(err));
        });
        return s;
      }
    } catch (err) {
      log("Error reading log file", String(err));
      return undefined;
    }
  }

  public async getLogs(
    authHeader: z.output<typeof AuthHeader>,
    runId: number
  ): Promise<string | undefined> {
    const nfs = await this.getNafs();
    const run = await Run.findByPk(runId);
    try {
      if (run?.logFile) {
        const file = await nfs.promises.readFile(run.logFile, "utf-8");
        return file.toString();
      }
    } catch (err) {
      log("Error reading log file", err);
      return undefined;
    }
  }

  private nafsIntance: Awaited<ReturnType<typeof nafs>> | undefined;

  private async getNafs() {
    if (this.nafsIntance) {
      return this.nafsIntance;
    }
    const remoteFs = await nafs(this.nafsUri);
    await remoteFs.promises.mkdir("/", { recursive: true });
    this.nafsIntance = remoteFs;
    return remoteFs;
  }

  protected createConsole(
    stdoutStream: stream.PassThrough,
    stderrStream: stream.PassThrough
  ) {
    return new console.Console({
      stdout: stdoutStream,
      stderr: stderrStream,
      ignoreErrors: true,
      colorMode: false,
    });
  }

  protected async fork(
    runMessage: RunHandlerInCp,
    { stdout, stderr, toggleSaveOutput }: StreamHandle
  ) {
    if (this.inlineWorker) {
      const definition = this.getLocalHandler(
        runMessage.functionId,
        runMessage.version
      );
      const origConsole = console;
      global.console = this.createConsole(stdout, stderr);
      global.console.Console = console.Console;
      let exitSignal = "0";
      toggleSaveOutput(true);
      try {
        await definition.definition.job(runMessage.migratedData ?? undefined);
      } catch (err) {
        console.error(err);
        exitSignal = "1";
      }
      toggleSaveOutput(false);
      global.console = origConsole;
      return exitSignal;
    }
    return new Promise<string>((resolve, reject) => {
      const argv = this.forkArgv ?? process.argv.slice(1);
      log("Launching", ...process.execArgv, argv[0], ...argv.slice(1));
      const child = cp.fork(argv[0], argv.slice(1), {
        env: { ...process.env, ENSCHEDULE_CHILD_WORKER: "true" },
        stdio: "pipe",
      });

      child.on("close", (code, signal) => {
        const exitCode = code !== null ? String(code) : signal ?? "0";
        log("closing child process", exitCode);
        resolve(exitCode);
      });

      child.on("error", (err) =>
        log("There was an error with the child process", err)
      );
      child.stdout?.pipe(stdout);
      child.stderr?.pipe(stderr);
      child.on("message", (msg) => {
        if (msg === "initialize") {
          toggleSaveOutput(true);
          child.send(runMessage, (err) => {
            if (err) {
              log(
                "There was an error when sending the data to the child process"
              );
              reject(err);
            }
          });
        }
        // optional
        if (msg === "done") {
          toggleSaveOutput(false);
          child.send("done", (err) => {
            if (err) {
              log(
                'There was an error when sending the "done" signal to the child process'
              );
              log(err);
            }
          });
        }
      });

      child.on("spawn", () => {
        log("Spawned child process for job");
      });
    });
  }

  public async listenForIncomingRuns(): Promise<boolean> {
    const ps = process.send?.bind(process);
    if (process.env.ENSCHEDULE_CHILD_WORKER === "true" && ps) {
      return new Promise<boolean>((resolve) => {
        process.once("message", (message) => {
          const {
            functionId,
            migratedData: data,
            version,
          } = RunHandlerInCpSchema.parse(message);
          const definition = this.getLocalHandler(functionId, version);
          (async () => {
            try {
              await definition.definition.job(definition.migrateData(data));
            } catch (err) {
              console.error(err);
              return true;
            }
            return false;
          })()
            .then((hadError) => {
              const promise = new Promise<boolean>((resolveClose) => {
                process.once("message", (doneMessage) => {
                  if (doneMessage === "done") {
                    resolveClose(hadError);
                  }
                });
              });
              ps("done");
              return promise;
            })
            .then((hadError) => {
              if (hadError) {
                log("exiting with 1 because job errored");
                process.exit(1);
              }
              return Promise.resolve();
            })
            .catch(() => {
              // ignore
            })
            .finally(() => {
              log("job fn done");
              resolve(true);
              process.exit(0);
            });
        });
        log("Child process is ready");
        ps("initialize");
      });
    }
    return false;
  }

  private async scheduleSingleRun(schedule: Schedule) {
    const definition = this.getLocalHandler(
      schedule.functionId,
      schedule.functionVersion
    );
    log(
      "Will run",
      definition.definition.title,
      "version",
      definition.version === schedule.functionVersion
        ? definition.version
        : `${definition.version} (migrated from ${schedule.functionVersion})`,
      "according to the",
      schedule.title,
      "schedule"
    );
    const startedAt = new Date();
    /**
     * It is new Date if the runNow: true was used on the schedule
     */
    const runAt = schedule.runAt ?? new Date();

    const worker = await this.registerWorker();

    const run = await this.sequelize.transaction(async (transaction) => {
      const tRun = await schedule.createRun(
        {
          scheduledToRunAt: runAt,
          startedAt,
          data: schedule.data ?? null,
          workerId: worker.id,
          functionId: definition.definition.id,
          functionVersion: definition.version,
          scheduleTitle: `${schedule.title}, #${schedule.id}`,
          workerTitle: `${worker.title}, #${worker.id}`,
        },
        {
          include: {
            model: Worker,
            as: "worker",
          },
          transaction,
        }
      );

      // inherit the access from the schedule
      const accessData = schedule.defaultRunAccess;

      if (!accessData) {
        return tRun;
      }

      // Set up view access associations
      if (accessData.view) {
        if (accessData.view.users && accessData.view.users.length > 0) {
          await tRun.setUserViewAccess(accessData.view.users, { transaction });
        }
        if (accessData.view.groups && accessData.view.groups.length > 0) {
          await tRun.setGroupViewAccess(accessData.view.groups, {
            transaction,
          });
        }
      }

      // Set up view logs access associations
      if (accessData.viewLogs) {
        if (accessData.viewLogs.users && accessData.viewLogs.users.length > 0) {
          await tRun.setUserViewLogsAccess(accessData.viewLogs.users, {
            transaction,
          });
        }
        if (
          accessData.viewLogs.groups &&
          accessData.viewLogs.groups.length > 0
        ) {
          await tRun.setGroupViewLogsAccess(accessData.viewLogs.groups, {
            transaction,
          });
        }
      }

      // Set up delete access associations
      if (accessData.delete) {
        if (accessData.delete.users && accessData.delete.users.length > 0) {
          await tRun.setUserDeleteAccess(accessData.delete.users, {
            transaction,
          });
        }
        if (accessData.delete.groups && accessData.delete.groups.length > 0) {
          await tRun.setGroupDeleteAccess(accessData.delete.groups, {
            transaction,
          });
        }
      }
      return tRun;
    });

    await this.sequelize.transaction(async (transaction) => {
      schedule.numRuns += 1;
      await schedule.setLastRun(run, { transaction });
      await schedule.save({ transaction });
    });

    const { finishedAt } = await this.runDbSchedule(schedule, run);
    log(
      "Finished running",
      definition.definition.title,
      "version",
      definition.version === schedule.functionVersion
        ? definition.version
        : `${definition.version} (migrated from ${schedule.functionVersion})`,
      "according to the",
      schedule.title,
      "schedule",
      "and it took",
      `${String(finishedAt.getTime() - startedAt.getTime())}ms`
    );

    log(
      `Storing the stdout and stderr from the job (${definition.definition.title} @ ${schedule.title})`
    );

    await worker.setLastRun(run);
    await worker.save();

    await run.reload({
      include: { model: Worker, as: "worker", required: false },
    });

    return run;
  }

  public retryStrategy(schedule: PublicJobSchedule) {
    return Math.min(60000 * 2 ** schedule.retries, 5 * 60 * 1000);
  }

  protected async runOverdueJobs() {
    const claimed = await this.claimUnclaimedOverdueJobs();
    const numJobs = claimed.length;
    const overdueJobs = claimed;
    if (numJobs > 0) {
      log(
        `Claimed ${numJobs} jobs that run in the following definition(schedule):`,
        overdueJobs
          .map(
            (schedule) =>
              `${
                this.getLocalHandler(
                  schedule.functionId,
                  schedule.functionVersion
                ).definition.title
              }${schedule.title}`
          )
          .join(", ")
      );
    }

    // We are not using parallel because sqlite can not handle parallel transactions
    // (which are used in this.scheduleSingleRun() -> this.registerWorker())
    // so no Promise.all, but a for loop instead
    // await Promise.all(overdueJobs.map(async (schedule) => {}));
    /* eslint-disable no-await-in-loop */
    for (const schedule of overdueJobs) {
      try {
        const run = await this.scheduleSingleRun(schedule);
        const noMaxRetries = schedule.maxRetries === -1;

        const shouldRetry =
          noMaxRetries || schedule.retries < schedule.maxRetries - 1;

        if (schedule.retryFailedJobs === true) {
          if (run.exitSignal !== "0") {
            if (shouldRetry) {
              const nextRun = this.retryStrategy(
                createPublicJobSchedule(
                  schedule,
                  createPublicJobDefinition(
                    this.getLocalHandler(
                      schedule.functionId,
                      schedule.functionVersion
                    ).definition
                  )
                )
              );
              schedule.runAt = new Date(Date.now() + nextRun);
              schedule.claimed = false;
              schedule.retries += 1;
              await schedule.save();
              return;
            }
            const trigger = await schedule.getFailureTrigger();
            if (trigger) {
              await this.runScheduleNow(trigger.id);
            }
          }
        }
        if (schedule.cronExpression) {
          const runAt = parseExpression(schedule.cronExpression)
            .next()
            .toDate();
          schedule.runAt = runAt;
          schedule.claimed = false;
        }
        if (schedule.retryFailedJobs === true) {
          if (run.exitSignal === "0") {
            // success reset the retries:
            schedule.retries = -1;
          } else if (schedule.retries >= schedule.maxRetries - 1) {
            // we will not retry anymore
            schedule.retries = schedule.maxRetries;
          }
        }
        await schedule.save();
      } catch (err) {
        console.error("Could not fully run the function", err);
      }
    }
    /* eslint-enable no-await-in-loop */
    return claimed;
  }
  public async deleteSchedules(scheduleIds: number[]) {
    await Schedule.destroy({ where: { id: scheduleIds } });
    return scheduleIds;
  }
  public async deleteSchedule(
    authHeader: z.output<typeof AuthHeader>,
    scheduleId: number
  ) {
    const schedule = await Schedule.findByPk(scheduleId, {
      include: [
        {
          model: Run,
          as: "lastRun",
          include: [
            {
              model: Worker,
              as: "worker",
            },
          ],
        },
      ],
    });
    if (!schedule) {
      throw new Error("invalid scheduleId");
    }
    const jobDef = this.getHandler(
      schedule.functionId,
      schedule.functionVersion,
      await this.getWorkers(authHeader)
    );
    const publicSchedule = createPublicJobSchedule(schedule, jobDef);

    await schedule.destroy();

    return publicSchedule;
  }
  private scryptParams = {
    keylen: 64,
    N: 16384,
    r: 8,
    p: 1,
  };
  public async register({
    username,
    email,
    password,
    name,
    admin = false,
  }: {
    username: string;
    email?: string;
    password: string;
    name: string;
    admin?: boolean;
  }): Promise<{
    access?: { refreshToken: string; accessToken: string };
    user: User;
  }> {
    const hashPassword = () => {
      return new Promise<string>((resolve, reject) => {
        const salt = crypto.randomBytes(16).toString("hex");
        crypto.scrypt(
          password,
          salt,
          this.scryptParams.keylen,
          this.scryptParams,
          (err, derivedKey) => {
            if (err) reject(err);
            resolve(`${salt}:${derivedKey.toString("hex")}`);
          }
        );
      });
    };

    const hashedPassword = await hashPassword();
    const user = await this.User.findOrCreate({
      where: {
        username,
      },
      defaults: {
        username,
        email,
        password: hashedPassword,
        admin,
        name,
      },
    });
    return { access: await this.login(username, password), user: user[0] };
  }

  public async login(
    username: string,
    password: string
  ): Promise<undefined | { refreshToken: string; accessToken: string }> {
    log("Logging in");

    const verifyPassword = (hash: string) => {
      return new Promise<boolean>((resolve, reject) => {
        const [salt, key] = hash.split(":");
        crypto.scrypt(
          password,
          salt,
          this.scryptParams.keylen,
          this.scryptParams,
          (err, derivedKey) => {
            if (err) reject(err);
            resolve(key === derivedKey.toString("hex"));
          }
        );
      });
    };

    const user = await this.User.findOne({ where: { username } });
    if (!user) {
      log("User not found");
      return;
    }

    const passwordCorrect = await verifyPassword(user.password);
    if (!passwordCorrect) {
      log("Password incorrect");
      return;
    }

    const refreshToken = this.createRefreshToken(user.id);

    await this.Session.create({
      userId: user.id,
      refreshToken,
    });
    return {
      accessToken: this.createAccessToken(user.id, user.admin),
      refreshToken,
    };
  }

  public async logout(refreshToken: string, allDevices: boolean) {
    let where: WhereOptions<InferAttributes<Session>> = { refreshToken };

    if (allDevices) {
      const decoded = await new Promise<{ userId: number }>(
        (resolve, reject) => {
          jwt.verify(
            refreshToken,
            this.refreshTokenSecret,
            (err, rawDecoded) => {
              if (err) reject(err);
              resolve(z.object({ userId: z.number() }).parse(rawDecoded));
            }
          );
        }
      );
      where = { userId: decoded.userId };
    }

    await this.Session.destroy({ where });
  }

  private createAccessToken(userId: number, admin: boolean) {
    return jwt.sign({ userId, admin }, this.accessTokenSecret, {
      expiresIn: "30s",
    });
  }
  private refreshTokenDuration = 7 * 24 * 60 * 60 * 1000; // 7 days

  private createRefreshToken(userId: number) {
    return jwt.sign({ userId }, this.refreshTokenSecret, {
      expiresIn: this.refreshTokenDuration,
    });
  }

  public async refreshToken(
    refreshToken: string
  ): Promise<undefined | { refreshToken: string; accessToken: string }> {
    const decoded = await new Promise<{
      userId: number;
      iat: number;
      exp: number;
    }>((resolve, reject) => {
      jwt.verify(
        refreshToken,
        this.refreshTokenSecret,
        { ignoreExpiration: true },
        (err, rawDecoded) => {
          if (err) reject(err);
          resolve(
            z
              .object({ userId: z.number(), iat: z.number(), exp: z.number() })
              .parse(rawDecoded)
          );
        }
      );
    });

    const session = await this.Session.findOne({
      where: { refreshToken, userId: decoded.userId },
    });

    if (!session) {
      log("Session not found");
      return;
    }

    if (Date.now() > decoded.exp * 1000) {
      await session.destroy();
      log("Refresh token has expired");
      return;
    }

    const user = await this.User.findByPk(decoded.userId);

    if (!user) {
      log("User not found, but the session exists. This should not happen");
      return;
    }

    const newAccessToken = this.createAccessToken(user.id, user.admin);
    const newRefreshToken = this.createRefreshToken(decoded.userId);
    session.refreshToken = newRefreshToken;
    await session.save();

    return {
      refreshToken: newRefreshToken,
      accessToken: newAccessToken,
    };
  }

  public async getUser(
    authHeader: z.output<typeof AuthHeader>,
    userId: number
  ) {
    const auth = await this.getUserAuth(authHeader);
    if (!auth) {
      return;
    }
    if (auth.userId !== userId && !auth.admin) {
      return;
    }
    const user = await this.User.findByPk(userId);
    return user ? createPublicUser(user) : undefined;
  }

  public async getUsers(authHeader: z.output<typeof AuthHeader>) {
    const auth = await this.getUserAuth(authHeader);
    if (!auth?.admin) {
      return [];
    }
    const users = await this.User.findAll();
    return users.map(createPublicUser);
  }
}

// TODO
/*
[x] Handle cron jobs
[x] Handle error and data
[ ] Handle cleanup jobs
[x] Handle ticker, handle duplicate jobs (same job signature with in a tick frame should not be duplicated)
[x] Start cron jobs when the ticker starts
[x] Handle overDueJobs taking more than tick time to complete and jobs stacking up, introduce a general timeout / max-in-queue
[x] A a job and a cronjob is the same, make Run a separate table with time, stdout stderr. So a job can have multiple runs (re-runs) and a cron will also have repeated runs
*/

export class TestBackend extends PrivateBackend {
  public maxJobsPerTick = 4;
  public pollInterval = 5;

  public getDefinedJobs() {
    return this.definedJobs;
  }

  public getSequelize() {
    return this.sequelize;
  }

  public getRunModel() {
    return this.Run;
  }

  public getScheduleModel() {
    return this.Schedule;
  }

  public getWorkerModel() {
    return this.Worker;
  }

  public getWorkerInstance() {
    return this.workerInstance;
  }

  public authHeader: z.output<typeof AuthHeader>;

  constructor(
    backendOptions: BackendOptions,
    authHeader: z.output<typeof AuthHeader>
  ) {
    super(backendOptions);
    this.authHeader = authHeader;
  }

  public async createJobSchedule({
    functionId,
    title,
    description,
    functionVersion,
    data,
    options = {},
  }: {
    functionId: string;
    title: string;
    description: string;
    functionVersion: number;
    data: unknown;
    options?: CreateJobScheduleOptions;
  }) {
    return super.createJobSchedule({
      functionId,
      title,
      description,
      functionVersion,
      data,
      options,
    });
  }

  public setRegisteredWorker(worker: Worker | undefined) {
    this.registeredWorker = worker;
  }

  public async getDbSchedules() {
    return super.getDbSchedules();
  }
  public async getDbRuns() {
    return super.getDbRuns();
  }
  public getLocalHandler(id: string, version: number) {
    return super.getLocalHandler(id, version);
  }
  public createConsole(
    stdoutStream: stream.PassThrough,
    stderrStream: stream.PassThrough
  ) {
    return super.createConsole(stdoutStream, stderrStream);
  }
  public async fork(runMessage: RunHandlerInCp, streamHandle: StreamHandle) {
    return super.fork(runMessage, streamHandle);
  }
  public async runSchedule(
    authHeader: z.output<typeof AuthHeader>,
    scheduleId: number
  ) {
    return super.runSchedule(authHeader, scheduleId);
  }
  public claimUnclaimedOverdueJobs() {
    return super.claimUnclaimedOverdueJobs();
  }
  public runOverdueJobs() {
    return super.runOverdueJobs();
  }
  public createSignature(
    functionId: string,
    runAt: Date,
    data: unknown,
    cronExpression?: string
  ): string {
    return super.createSignature(functionId, runAt, data, cronExpression);
  }

  public async tick() {
    return super.tick();
  }

  public getLatestHandlers() {
    return super.getLatestHandlers(this.authHeader);
  }
}
