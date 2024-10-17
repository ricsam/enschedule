import * as cp from "node:child_process";
import * as crypto from "node:crypto";
import os from "node:os";
import stream from "node:stream";
import type {
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
  WhereOptions,
} from "sequelize";
import { DataTypes, Model, Op, Sequelize } from "sequelize";
import type { ZodType } from "zod";
import { z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { createTypeAlias, printNode, zodToTs } from "zod-to-ts";
import type { SeqConstructorOptions } from "./env-sequalize-options";
import { envSequalizeOptions } from "./env-sequalize-options";
import { log } from "./log";

export const getTokenEnvs = () => {
  const ACCESS_TOKEN_SECRET = process.env.ACCESS_TOKEN_SECRET;
  const REFRESH_TOKEN_SECRET = process.env.REFRESH_TOKEN_SECRET;

  if (!ACCESS_TOKEN_SECRET || !REFRESH_TOKEN_SECRET) {
    throw new Error(
      "Missing required environment variables ACCESS_TOKEN_SECRET and REFRESH_TOKEN_SECRET. Please check your .env file."
    );
  }
  return { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET };
};

const { ACCESS_TOKEN_SECRET, REFRESH_TOKEN_SECRET } = getTokenEnvs();

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
  const pendingThreshold = pollInterval + 5 * 1000;
  const downThreshold = 2 * pollInterval + 5 * 1000;

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
  };
};

export const createPublicJobDefinition = (
  jobDef: JobDefinition
): PublicJobDefinition => {
  const identifier = pascalCase(jobDef.title);
  const { node } = zodToTs(jobDef.dataSchema, identifier);
  const typeAlias = createTypeAlias(node, identifier);
  const codeBlock = printNode(typeAlias).replace(/^(?: {4})+/gm, "  ");
  const jsonSchema: Record<string, unknown> = zodToJsonSchema(
    jobDef.dataSchema,
    identifier
  );

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
    stdout: run.stdout,
    stderr: run.stderr,
    createdAt: run.createdAt,
    exitSignal: run.exitSignal ?? undefined,
    finishedAt: run.finishedAt ?? undefined,
    startedAt: run.startedAt,
    scheduledToRunAt: run.scheduledToRunAt,
    data: run.data,
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

const getScheduleStatus = (schedule: Schedule): ScheduleStatus => {
  let status = ScheduleStatus.UNSCHEDULED;
  if (schedule.runAt || schedule.runNow === true) {
    status = ScheduleStatus.SCHEDULED;
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
  const status = getScheduleStatus(schedule);
  return {
    id: schedule.id,
    title: schedule.title,
    description: schedule.description,
    retryFailedJobs: schedule.retryFailedJobs,
    retries: schedule.retries,
    maxRetries: schedule.maxRetries,
    runAt: schedule.runAt || undefined,
    runNow: schedule.runNow,
    cronExpression: schedule.cronExpression || undefined,
    lastRun: schedule.lastRun ? serializeRun(schedule.lastRun) : undefined,
    handlerId: schedule.handlerId,
    createdAt: schedule.createdAt,
    jobDefinition: jobDef,
    numRuns: schedule.numRuns,
    data: schedule.data,
    status,
    eventId: schedule.eventId ?? undefined,
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
    stdout: run.stdout,
    stderr: run.stderr,
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
    data: run.data,
    worker: run.worker ? createPublicWorker(run.worker) : run.workerTitle,
    status,
  };
};

export interface StreamHandle {
  stdout: stream.PassThrough;
  stderr: stream.PassThrough;
  toggleBuffering: (on: boolean) => void;
}

interface CreateJobScheduleOptions {
  cronExpression?: string;
  eventId?: string;
  runAt?: Date;
  retryFailedJobs?: boolean;
  maxRetries?: number;
  failureTrigger?: number;
  workerId?: string;
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

  declare defaultFunctionAccess?: FunctionAccess;
  declare defaultScheduleAccess?: ScheduleAccess;
  declare defaultRunAccess?: RunAccess;

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
  declare description: string;
  /** job handlerId, i.e. the handler the schedule executes */
  declare handlerId: string;
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
  declare handlerVersion: number;
  declare data: string;

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

  // declare static associations: {
  //   runs: Association<Schedule, Run>;
  //   lastRun: Association<Schedule, Run>;
  // };
}

class Run extends Model<InferAttributes<Run>, InferCreationAttributes<Run>> {
  declare id: CreationOptional<number>;
  declare stdout: CreationOptional<string>; // default ''
  declare stderr: CreationOptional<string>; // default ''
  declare data: string;
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

  declare handlerId: string; // same as schedule.handlerId, but in case schedule is deleted the handlerId can still be found
  declare handlerVersion: number; // same as schedule.handlerVersion, but in case schedule is deleted the handlerVersion can still be found
  declare scheduleTitle: string; // same as `${schedule.title}, #${schedule.id}`, but in case schedule is deleted a scheduleTitle can still be found
  declare schedule?: NonAttribute<Schedule> | null;

  declare workerTitle: string; // same as `${worker.title}, #${worker.id}`, but in case worker is deleted a workerTitle can still be found
  declare worker?: NonAttribute<Worker> | null;
}

export const createJobDefinition = <T extends ZodType = ZodType>(
  job: JobDefinition<T>
) => job;

interface UserAccess {
  admin: boolean;
  groups: string[];
  username?: string;
}

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

export class PrivateBackend {
  protected maxJobsPerTick = 4;
  public tickDuration = 5000;
  public logStoreInterval = 5000;
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
          allowNull: false,
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
        handlerVersion: {
          type: DataTypes.INTEGER,
          allowNull: false,
        },
        data: {
          type: DataTypes.TEXT,
          allowNull: false,
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
          allowNull: false,
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
        handlerId: {
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
        stdout: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: "",
        },
        stderr: {
          type: DataTypes.TEXT,
          allowNull: false,
          defaultValue: "",
        },
        data: {
          type: DataTypes.TEXT,
          allowNull: false,
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
        handlerId: {
          type: DataTypes.STRING(),
          allowNull: false,
        },
        handlerVersion: {
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
    });
    // foreign key on Run, run.scheduleId, run.schedule
    Run.belongsTo(Schedule, {
      foreignKey: {
        name: "scheduleId",
        allowNull: true, // on schedule deletion, runs are not deleted
      },
      as: "schedule",
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
    });
    // foreign key on Run, run.workerId
    Run.belongsTo(Worker, {
      as: "worker",
      foreignKey: {
        name: "workerId",
        allowNull: true,
      },
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
      as: "lastRun",
    });

    //#endregion

    //#region worker.lastRun
    Worker.belongsTo(Run, {
      foreignKey: {
        name: "lastRunId", // worker.lastRunId
        allowNull: true,
      },
      as: "lastRun",
    });
    //#endregion

    Schedule.belongsTo(Schedule, {
      foreignKey: {
        name: "failureTriggerId",
        allowNull: true,
      },
      as: "failureTrigger",
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
    });
    Group.belongsToMany(User, { through: "UserGroupAssociation", as: "users" });
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

    this.Run = Run;
    this.Schedule = Schedule;
    this.Worker = Worker;
    this.Group = Group;
    this.User = User;
    this.Session = Session;
    this.ApiKey = ApiKey;
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
          // eslint-disable-next-line @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-member-access, @typescript-eslint/no-dynamic-delete
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
  protected getLocalHandler(id: string, version: number): JobDefinition {
    const versions = this.definedJobs[id];
    if (!versions) {
      throw new Error("invalid id");
    }
    const def = versions[version];
    if (!def) {
      throw new Error("invalid version");
    }

    return def;
  }
  public async getRuns({
    scheduleId,
    order,
    limit,
    offset,
  }: ListRunsOptions): Promise<PublicJobRun[]> {
    if (scheduleId === undefined) {
      const runs = await Run.findAll({
        limit,
        order,
        offset,
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
        ],
      });
      const workers = await this.getWorkers();
      return Promise.all(
        runs.map(async (run) => {
          const jobSchedule = run.schedule;
          return createPublicJobRun(
            run,
            jobSchedule ?? run.scheduleTitle,
            await this.getHandler(run.handlerId, run.handlerVersion, workers)
          );
        })
      );
    }

    const jobSchedule = await Schedule.findByPk(scheduleId, {
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
    if (!jobSchedule) {
      throw new Error("invalid jobScheduleId");
    }
    const runs = await jobSchedule.getRuns({
      limit,
      order,
      offset,
      include: [
        {
          model: Worker,
          as: "worker",
        },
      ],
    });
    const workers = await this.getWorkers();
    return Promise.all(
      runs.map(async (run) =>
        createPublicJobRun(
          run,
          jobSchedule,
          await this.getHandler(
            jobSchedule.handlerId,
            jobSchedule.handlerVersion,
            workers
          )
        )
      )
    );
  }
  public async getRun(runId: number): Promise<PublicJobRun> {
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
      await this.getHandler(run.handlerId, run.handlerVersion)
    );
  }

  public async reset(): Promise<void> {
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
  }

  public async deleteRun(runId: number): Promise<PublicJobRun> {
    const run = await Run.findByPk(runId);
    if (!run) {
      throw new Error("invalid runId");
    }
    const publicRun = await this.getRun(runId);

    await run.destroy();

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
  public async getSchedule(id: number): Promise<PublicJobSchedule | undefined> {
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
    const handler = await this.getHandler(
      schedule.handlerId,
      schedule.handlerVersion
    );
    return createPublicJobSchedule(schedule, handler);
  }

  private async getHandler(
    handlerId: string,
    version: number,
    _workers?: PublicWorker[]
  ): Promise<string | PublicJobDefinition> {
    const onServerHandler = this.definedJobs[handlerId]?.[version];
    if (onServerHandler) {
      return createPublicJobDefinition(onServerHandler);
    }
    const workers = _workers ?? (await this.getWorkers());
    const workersThatAreUp = workers.filter((worker) => {
      // prioritize workers that are up
      return worker.status === WorkerStatus.UP;
    });
    for (const worker of [...workersThatAreUp, ...workers]) {
      const handler = worker.definitions.find((def) => {
        return def.id === handlerId && def.version === version;
      });
      if (handler) {
        return handler;
      }
    }
    return handlerId;
  }

  public async getLatestHandler(
    handlerId: string,
    authHeader: string
  ): Promise<PublicJobDefinition> {
    const handlers = await this.getLatestHandlers(authHeader);
    const handler = handlers.find((h) => h.id === handlerId);
    if (!handler) {
      throw new Error("invalid handlerId or the worker is not online");
    }
    return handler;
  }

  public canViewFunction(
    user: UserAccess,
    def: PublicJobDefinition,
    worker: PublicWorker
  ): boolean {
    if (user.admin) {
      return true;
    }
    const hasAccess = (access: FunctionAccess | undefined) => {
      if (!access) {
        return false;
      }
      if (user.username) {
        if (access.view?.users?.includes(user.username)) {
          return true;
        }
      }
      if (user.groups.length > 0) {
        const groups = access.view?.groups;
        if (groups?.some((group) => user.groups.includes(group))) {
          return true;
        }
      }
      return false;
    };
    if (hasAccess(worker.defaultFunctionAccess)) {
      return true;
    }
    if (hasAccess(def.access)) {
      return true;
    }
    return false;
  }

  public async getUserFromAuthHeader(
    authHeader: string
  ): Promise<UserAccess | undefined> {
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
            jwt.verify(token, ACCESS_TOKEN_SECRET, (err, d) => {
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
            groups: (user.groups ?? []).map((group) => group.groupName),
            username: user.username,
          };
        }
      } catch (error) {
        return undefined;
      }
    }
    if (type === "Api-Key") {
      if (token === process.env.API_KEY) {
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
          groups: (apiKey.user.groups ?? []).map((group) => group.groupName),
          username: apiKey.user.username,
        };
      }
    }
    throw new Error("invalid auth header");
  }

  public async getLatestHandlers(
    authHeader: string
  ): Promise<PublicJobDefinition[]> {
    const handlerMap: Record<
      string,
      { def: PublicJobDefinition; version: number } | undefined
    > = {};
    const upWorkers = (await this.getWorkers()).filter((worker) => {
      return worker.status === WorkerStatus.UP;
    });

    const userAccess = await this.getUserFromAuthHeader(authHeader);

    if (!userAccess) {
      return [];
    }

    upWorkers.forEach((worker) => {
      worker.definitions.forEach((def: PublicJobDefinition) => {
        if (!this.canViewFunction(userAccess, def, worker)) {
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
    filters?: z.output<typeof SchedulesFilterSchema>
  ): Promise<PublicJobSchedule[]> {
    const dbSchedules = await this.getDbSchedules(filters);
    const workers = await this.getWorkers();
    return Promise.all(
      dbSchedules.map(async (schedule) => {
        return createPublicJobSchedule(
          schedule,
          await this.getHandler(
            schedule.handlerId,
            schedule.handlerVersion,
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
        const worker = this.registeredWorker;
        await worker.reload();
        worker.lastReached = new Date();
        await worker.save();

        return this.registeredWorker;
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
          pollInterval: this.tickDuration,
          definitions: this.getPublicHandlers(),
          defaultFunctionAccess: this.defaultFunctionAccess,
          defaultScheduleAccess: this.defaultScheduleAccess,
          defaultRunAccess: this.defaultRunAccess,
        });

        if (hashes.size > 0 && !hashes.has(thisWorkerHash)) {
          version += 1;
        }

        const [worker] = await this.Worker.findOrCreate({
          where: {
            workerId: this.workerInstance.workerId,
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
            pollInterval: this.tickDuration,
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
    handlerId: string,
    runAt: Date | undefined,
    data: unknown,
    cronExpression: string | undefined
  ): string {
    const rounded = runAt
      ? Math.floor(runAt.getTime() / 1000) * 1000
      : "manual";
    let signature = `${handlerId}-${rounded}-${JSON.stringify(data)}`;
    if (cronExpression) {
      signature += `-${parseExpression(cronExpression).stringify(true)}`;
    }
    return signature;
  }
  protected async createJobSchedule(
    defId: string,
    title: string,
    description: string,
    handlerVersion: number,
    data: unknown,
    options: CreateJobScheduleOptions = {}
  ) {
    let migratedVersion = handlerVersion;
    let migratedData = data;
    // eslint-disable-next-line @typescript-eslint/no-unnecessary-condition, no-constant-condition
    while (true) {
      const migration = this.migrations[defId]?.[migratedVersion];
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
    } = options;
    const signature = this.createSignature(
      defId,
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

    const serializedData = JSON.stringify(migratedData);
    const defaults = {
      handlerVersion: migratedVersion,
      retryFailedJobs,
      workerId,
      maxRetries,
      handlerId: defId,
      cronExpression: normalizedCronExpression,
      runAt,
      data: serializedData,
      signature,
      title,
      description,
      failureTriggerId: failureTrigger,
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
      /* eslint-disable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unnecessary-condition */
      // update the schedule
      let updated = false;

      Object.keys(defaults).forEach((_key) => {
        const key = _key as keyof typeof defaults;

        const value = defaults[key] as any;

        if (key === "runAt") {
          // because we are comparing date objects
          if (String(schedule[key]) === String(value)) {
            return;
          }
        }

        // sequelize returns null for undefined values
        if (schedule[key] === null) {
          if (value === undefined) {
            return;
          }
        }

        if (schedule[key] !== value) {
          (schedule as Record<string, any>)[key] = value;
          updated = true;
        }
      });

      if (updated) {
        status = "updated";
      }
      /* eslint-enable @typescript-eslint/no-explicit-any, @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-unnecessary-condition */

      await schedule.save();
    }

    return [schedule, status] as const;
  }

  public async scheduleJob(
    handlerId: string,
    handlerVersion: number,
    data: unknown,
    options: ScheduleJobOptions
  ): Promise<ScheduleJobResult>;
  public async scheduleJob<T extends ZodType = ZodType>(
    job: JobDefinition<T>,
    handlerVersion: number,
    data: z.infer<T>,
    options: ScheduleJobOptions
  ): Promise<ScheduleJobResult>;
  public async scheduleJob(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    def: string | JobDefinition<any>,
    handlerVersion: number,
    data: unknown,
    options: ScheduleJobOptions
  ): Promise<ScheduleJobResult> {
    const defId = typeof def === "string" ? def : def.id;

    let runAt: Date | undefined = options.runAt;
    const cronExpression: string | undefined = options.cronExpression;

    if (cronExpression) {
      runAt = parseExpression(cronExpression).next().toDate();
    }

    const { retryFailedJobs, maxRetries, failureTrigger } = options;

    const [dbSchedule, status] = await this.createJobSchedule(
      defId,
      options.title,
      options.description,
      handlerVersion,
      data,
      {
        eventId: options.eventId,
        runAt,
        cronExpression,
        retryFailedJobs,
        maxRetries,
        failureTrigger,
      }
    );
    return {
      schedule: createPublicJobSchedule(
        dbSchedule,
        await this.getHandler(dbSchedule.handlerId, dbSchedule.handlerVersion)
      ),
      status,
    };
  }

  public async runScheduleNow(scheduleId: number) {
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
    // only fetch jobs for a server that has a job definition for the schedule handlerId
    const jobKeys = Object.keys(this.definedJobs);
    if (jobKeys.length === 0) {
      throw new Error("You have no registered jobs on this client");
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
              handlerId: {
                [Op.in]: jobKeys,
              },
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
    return job;
  }

  /**
   * e.g. `{ "handlerId": { "1": { targetVersion: 2, migrateFn: (data) => data } }`
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
    a: Pick<JobDefinition<T>, "id" | "dataSchema" | "version">,
    b: JobDefinition<U>,
    migrateFn: (a: z.infer<T>) => z.infer<U>
  ) {
    if (a.id !== b.id) {
      throw new Error("The definition ids must be the same");
    }

    const job = this.registerJob(b);

    const migrations = this.migrations[a.id] ?? {};
    migrations[a.version] = {
      targetVersion: b.version,
      migrateFn,
    };
    this.migrations[a.id] = migrations;

    const schedules = await Schedule.findAll({
      order: [["createdAt", "DESC"]],
      include: {
        model: Run,
        as: "lastRun",
      },
      where: {
        handlerId: a.id,
      },
    });

    await Promise.all(
      schedules.map(async (schedule) => {
        if (schedule.handlerVersion === a.version) {
          const data = a.dataSchema.parse(
            JSON.parse(schedule.data)
          ) as z.infer<T>;
          const newData = b.dataSchema.parse(migrateFn(data)) as z.infer<U>;
          schedule.data = JSON.stringify(newData);
          schedule.handlerVersion = b.version;
          await schedule.save();
        }
      })
    );
    return job;
  }

  public async getWorkers(
    where?: WhereOptions<
      InferAttributes<
        Worker,
        {
          omit: "lastRun" | "runs";
        }
      >
    >
  ): Promise<z.output<typeof PublicWorkerSchema>[]> {
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
    return allWorkers.map(createPublicWorker);
  }

  public async migrateDatabase() {
    log("Migrating the database");
    await this.sequelize.sync();
  }

  public async startPolling(
    { dontMigrate = false }: { dontMigrate?: boolean } = {
      dontMigrate: false,
    }
  ) {
    if (!dontMigrate) {
      log("Migrating the database");
      await this.sequelize.sync();
    }
    await this.registerWorker();
    log("Polling the database for jobs");
    const now = Date.now();
    setTimeout(() => {
      setInterval(() => {
        log("Tick", String(new Date()));
        void this.tick();
      }, this.tickDuration);
    }, 1000 - (now - Math.floor(now / 1000) * 1000));
  }

  protected async tick() {
    await this.registerWorker();
    await this.runOverdueJobs();
  }

  /**
   * Will run a scheduele directly
   */
  protected async runSchedule(scheduleId: number) {
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
      await this.getHandler(schedule.handlerId, schedule.handlerVersion)
    );
  }

  /**
   * When updating the schedule from the schedule details page with the update button (this is the modal)
   */
  public async updateSchedule(
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
    if (typeof updatePayload.description === "string") {
      schedule.description = updatePayload.description;
    }
    if (typeof updatePayload.title === "string") {
      schedule.title = updatePayload.title;
    }
    if (typeof updatePayload.data === "string") {
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
    if (typeof updatePayload.retryFailedJobs === "boolean") {
      schedule.retryFailedJobs = updatePayload.retryFailedJobs;
    }
    if (typeof updatePayload.maxRetries === "number") {
      schedule.maxRetries = updatePayload.maxRetries;
    }
    await schedule.save();
    return createPublicJobSchedule(
      schedule,
      await this.getHandler(schedule.handlerId, schedule.handlerVersion)
    );
  }

  private async runDbSchedule(schedule: Schedule, run: Run) {
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
    const definition = this.getLocalHandler(
      schedule.handlerId,
      schedule.handlerVersion
    );
    const data: any = definition.dataSchema.parse(JSON.parse(schedule.data));
    return this.runDefinition(
      {
        handlerId: schedule.handlerId,
        data,
        version: schedule.handlerVersion,
      },
      run
    );
    /* eslint-enable */
  }

  public async runDefinition(runMessage: RunHandlerInCp, run: Run) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const output: { stderr: any[]; stdout: any[] } = { stderr: [], stdout: [] };
    const stdoutStream = new stream.PassThrough();
    const stderrStream = new stream.PassThrough();
    let buffering = false;
    const bufferStream = (
      pipeStream: stream.PassThrough,
      key: "stderr" | "stdout"
    ) => {
      const buffer = output[key];
      let _resolve: undefined | ((data: string) => void);
      pipeStream.on("data", (chunk) => {
        if (buffering) {
          buffer.push(chunk);
        }
      });
      pipeStream.on("finish", () => {
        if (_resolve) {
          _resolve(Buffer.concat(buffer).toString("utf8"));
        }
      });
      return new Promise<string>((resolve) => {
        _resolve = resolve;
      });
    };

    const toggleBuffering = (newBuffering: boolean) => {
      buffering = newBuffering;
    };

    const promises = [
      bufferStream(stdoutStream, "stdout"),
      bufferStream(stderrStream, "stderr"),
    ];

    if (this.logJobs) {
      stdoutStream.pipe(process.stdout, { end: false });
      stderrStream.pipe(process.stderr, { end: false });
    }

    const streamHandle: StreamHandle = {
      stdout: stdoutStream,
      stderr: stderrStream,
      toggleBuffering,
    };

    const _console = this.createConsole(stdoutStream, stderrStream);

    let waitingForBufferingToBe = true;
    let quickResolve: undefined | (() => void);

    const saveOutput = async () => {
      const stop = () => !buffering && !waitingForBufferingToBe;

      if (!stop()) {
        for (const key of ["stdout", "stderr"] as const) {
          const buffer = output[key];
          const currentOutput = Buffer.concat(buffer).toString("utf8");
          run[key] = currentOutput;
        }
        await run.save();
      }

      if (stop()) {
        return;
      }
      await new Promise<void>((resolve) => {
        const t = setTimeout(() => {
          resolve();
        }, this.logStoreInterval);
        quickResolve = () => {
          clearTimeout(t);
          resolve();
        };
      });

      if (stop()) {
        return;
      }
      await saveOutput();
    };

    const saveOutputPromise: Promise<void> = saveOutput();

    let exitSignal = "0";
    try {
      log("Creating a worker process to run", runMessage.handlerId);
      exitSignal = await this.fork(runMessage, streamHandle);
    } catch (err) {
      _console.error(err);
      exitSignal = "1";
    }
    stdoutStream.end();
    stderrStream.end();

    const [stdout, stderr] = await Promise.all(promises);
    const finishedAt = new Date();

    waitingForBufferingToBe = false;
    if (quickResolve) {
      quickResolve();
    }
    await saveOutputPromise;

    run.stderr = stderr;
    run.stdout = stdout;
    run.exitSignal = exitSignal;
    run.finishedAt = finishedAt;

    await run.save();

    return { stdout, stderr, exitSignal, finishedAt };
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
    { stdout, stderr, toggleBuffering }: StreamHandle
  ) {
    if (this.inlineWorker) {
      const definition = this.getLocalHandler(
        runMessage.handlerId,
        runMessage.version
      );
      const origConsole = console;
      global.console = this.createConsole(stdout, stderr);
      global.console.Console = console.Console;
      let exitSignal = "0";
      toggleBuffering(true);
      try {
        await definition.job(runMessage.data);
      } catch (err) {
        console.error(err);
        exitSignal = "1";
      }
      toggleBuffering(false);
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
          toggleBuffering(true);
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
          toggleBuffering(false);
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
          const { handlerId, data, version } =
            RunHandlerInCpSchema.parse(message);
          const definition = this.getLocalHandler(handlerId, version);
          (async () => {
            try {
              await definition.job(data);
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
      schedule.handlerId,
      schedule.handlerVersion
    );
    log(
      "Will run",
      definition.title,
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

    const run = await schedule.createRun(
      {
        scheduledToRunAt: runAt,
        startedAt,
        data: schedule.data,
        workerId: worker.id,
        handlerId: definition.id,
        handlerVersion: definition.version,
        scheduleTitle: `${schedule.title}, #${schedule.id}`,
        workerTitle: `${worker.title}, #${worker.id}`,
      },
      {
        include: {
          model: Worker,
          as: "worker",
        },
      }
    );

    schedule.numRuns += 1;
    await schedule.setLastRun(run);
    await schedule.save();

    const { finishedAt } = await this.runDbSchedule(schedule, run);
    log(
      "Finished running",
      definition.title,
      "according to the",
      schedule.title,
      "schedule",
      "and it took",
      `${String(finishedAt.getTime() - startedAt.getTime())}ms`
    );

    log(
      `Storing the stdout and stderr from the job (${definition.title} @ ${schedule.title})`
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
                  schedule.handlerId,
                  schedule.handlerVersion
                ).title
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
                      schedule.handlerId,
                      schedule.handlerVersion
                    )
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
  public async deleteSchedule(scheduleId: number) {
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
    const jobDef = await this.getHandler(
      schedule.handlerId,
      schedule.handlerVersion
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
  }) {
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
    await this.User.create({
      username,
      email,
      password: hashedPassword,
      admin,
      name,
    });
    return this.login(username, password);
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
    return { accessToken: this.createAccessToken(user.id), refreshToken };
  }

  public async logout(refreshToken: string, allDevices: boolean) {
    let where: WhereOptions<InferAttributes<Session>> = { refreshToken };

    if (allDevices) {
      const decoded = await new Promise<{ userId: number }>(
        (resolve, reject) => {
          jwt.verify(refreshToken, REFRESH_TOKEN_SECRET, (err, rawDecoded) => {
            if (err) reject(err);
            resolve(z.object({ userId: z.number() }).parse(rawDecoded));
          });
        }
      );
      where = { userId: decoded.userId };
    }

    await this.Session.destroy({ where });
  }

  private createAccessToken(userId: number) {
    return jwt.sign({ userId }, ACCESS_TOKEN_SECRET, {
      expiresIn: "30s",
    });
  }
  private refreshTokenDuration = 7 * 24 * 60 * 60 * 1000; // 7 days

  private createRefreshToken(userId: number) {
    return jwt.sign({ userId }, REFRESH_TOKEN_SECRET, {
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
        REFRESH_TOKEN_SECRET,
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

    const newAccessToken = this.createAccessToken(decoded.userId);
    const newRefreshToken = this.createRefreshToken(decoded.userId);
    session.refreshToken = newRefreshToken;
    await session.save();

    return {
      refreshToken: newRefreshToken,
      accessToken: newAccessToken,
    };
  }

  public async getUser(userId: number) {
    const user = await this.User.findByPk(userId);
    return user ? createPublicUser(user) : undefined;
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
  public tickDuration = 5000;
  public logStoreInterval = 1000;
  public sequelize: Sequelize = this.sequelize;
  public Run: typeof Run = this.Run;
  public Schedule: typeof Schedule = this.Schedule;
  public Worker: typeof Worker = this.Worker;
  public workerInstance: WorkerInstance = this.workerInstance;
  /**
   * `{ [id]: { [version]: JobDefinition }`
   */
  public definedJobs: Record<
    string,
    undefined | Record<string, JobDefinition | undefined>
  > = this.definedJobs;

  public registeredWorker: Worker | undefined = this.registeredWorker;

  private authHeader: string;

  constructor(backendOptions: BackendOptions, authHeader: string) {
    super(backendOptions);
    this.authHeader = authHeader;
  }

  public async createJobSchedule(
    handlerId: string,
    title: string,
    description: string,
    handlerVersion: number,
    data: unknown,
    options: CreateJobScheduleOptions = {}
  ) {
    return super.createJobSchedule(
      handlerId,
      title,
      description,
      handlerVersion,
      data,
      options
    );
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
  public async runSchedule(scheduleId: number) {
    return super.runSchedule(scheduleId);
  }
  public claimUnclaimedOverdueJobs() {
    return super.claimUnclaimedOverdueJobs();
  }
  public runOverdueJobs() {
    return super.runOverdueJobs();
  }
  public createSignature(
    handlerId: string,
    runAt: Date,
    data: unknown,
    cronExpression?: string
  ): string {
    return super.createSignature(handlerId, runAt, data, cronExpression);
  }

  public async tick() {
    return super.tick();
  }

  public getLatestHandlers() {
    return super.getLatestHandlers(this.authHeader);
  }
}
