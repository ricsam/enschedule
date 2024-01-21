import * as cp from "node:child_process";
import * as crypto from "node:crypto";
import os from "node:os";
import stream from "node:stream";
import { parseExpression } from "cron-parser";
import {
  RunHandlerInCpSchema,
  ScheduleStatus,
  WorkerStatus,
  JobDefinitionSchema,
  typeAssert,
} from "@enschedule/types";
import type {
  JobDefinition,
  ListRunsOptions,
  PublicJobDefinition,
  PublicJobRun,
  PublicJobSchedule,
  PublicWorker,
  PublicWorkerSchema,
  RunHandlerInCp,
  ScheduleJobOptions,
  ScheduleJobResult,
  ScheduleUpdatePayloadSchema,
  SchedulesFilterSchema,
  SerializedRun,
} from "@enschedule/types";
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
import type { ZodType, z } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { createTypeAlias, printNode, zodToTs } from "zod-to-ts";
import type { SeqConstructorOptions } from "./env-sequalize-options";
import { envSequalizeOptions } from "./env-sequalize-options";
import { log } from "./log";

function createWorkerHash(
  title: string,
  description: undefined | null | string,
  pollInterval: number,
  definitions: PublicJobDefinition[]
) {
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

const createPublicWorker = (dbWorker: Worker): PublicWorker => {
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

  return {
    versionHash: createWorkerHash(
      dbWorker.title,
      dbWorker.description,
      dbWorker.pollInterval,
      dbWorker.definitions
    ),
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
  };
};

export const serializeRun = (run: Run): SerializedRun => {
  return {
    id: Number(run.id),
    stdout: run.stdout,
    stderr: run.stderr,
    createdAt: run.createdAt,
    exitSignal: run.exitSignal,
    finishedAt: run.finishedAt,
    startedAt: run.startedAt,
    scheduledToRunAt: run.scheduledToRunAt,
    data: run.data,
  };
};

export const createPublicJobSchedule = (
  schedule: Schedule,
  jobDef: PublicJobDefinition | string
): PublicJobSchedule => {
  let status = ScheduleStatus.UNSCHEDULED;
  if (schedule.runAt) {
    status = ScheduleStatus.SCHEDULED;
  }
  if (schedule.lastRun) {
    if (schedule.lastRun.exitSignal !== "0") {
      status = ScheduleStatus.FAILED;
      if (schedule.retryFailedJobs === true) {
        if (
          schedule.runAt &&
          (schedule.maxRetries === -1 || schedule.retries < schedule.maxRetries)
        ) {
          status = ScheduleStatus.RETRYING;
        }
      }
    } else {
      status = ScheduleStatus.SUCCESS;
    }
  }
  return {
    id: schedule.id,
    title: schedule.title,
    description: schedule.description,
    retryFailedJobs: schedule.retryFailedJobs,
    retries: schedule.retries,
    maxRetries: schedule.maxRetries,
    runAt: schedule.runAt || undefined,
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

export const createPublicJobRun = (
  run: Run,
  schedule: Schedule,
  jobDef: PublicJobDefinition | string
): PublicJobRun => {
  return {
    id: Number(run.id),
    stdout: run.stdout,
    stderr: run.stderr,
    createdAt: run.createdAt,
    exitSignal: run.exitSignal,
    finishedAt: run.finishedAt,
    startedAt: run.startedAt,
    scheduledToRunAt: run.scheduledToRunAt,
    jobSchedule: createPublicJobSchedule(schedule, jobDef),
    data: run.data,
    worker: createPublicWorker(run.worker),
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

  declare instanceId: string;
  declare createdAt: CreationOptional<Date>;
  declare hostname: string;
  declare lastReached: Date;
  declare runs?: NonAttribute<Run[]>;

  declare workerPk: ForeignKey<Worker["id"]>;

  declare lastRun?: NonAttribute<Run> | null;
  declare getLastRun: HasOneGetAssociationMixin<Run>;
  declare setLastRun: HasOneSetAssociationMixin<Run, number>;
  declare createLastRun: HasOneCreateAssociationMixin<Run>;
  // declare static associations: {
  //   lastRun: Association<Worker, Run>;
  // };
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
   * Just to select claimed schedules after sql update
   */
  declare claimId: CreationOptional<string>;

  declare title: string;
  declare description: string;
  /** job definition handlerId, i.e. the definition that the schedule executes */
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
  declare runs?: NonAttribute<Run[]>;

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
  declare stdout: string;
  declare stderr: string;
  declare data: string;
  declare createdAt: CreationOptional<Date>;
  declare finishedAt: Date;
  declare startedAt: Date;
  declare scheduledToRunAt: Date;

  declare exitSignal: string;

  declare scheduleId: ForeignKey<Schedule["id"]>;
  declare workerId: ForeignKey<Worker["id"]>;

  declare getSchedule: HasOneGetAssociationMixin<Schedule>; // Note the null assertions!
  declare setSchedule: HasOneSetAssociationMixin<Schedule, number>;
  declare createSchedule: HasOneCreateAssociationMixin<Schedule>;

  declare schedule: NonAttribute<Schedule>;
  declare worker: NonAttribute<Worker>;
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
  public logJobs = false;
  protected sequelize: Sequelize;
  protected Run: typeof Run;
  protected Schedule: typeof Schedule;
  protected Worker: typeof Worker;
  private forkArgv: string[] | undefined;
  protected workerInstance: WorkerInstance;
  protected inlineWorker: boolean;

  constructor(backendOptions: BackendOptions) {
    const {
      database: passedDatabaseOptions,
      forkArgv,
      workerId,
      name,
      description,
      inlineWorker,
    } = backendOptions;

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
          allowNull: false,
        },
        finishedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        startedAt: {
          type: DataTypes.DATE,
          allowNull: false,
        },
        scheduledToRunAt: {
          type: DataTypes.DATE,
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
        allowNull: false,
      },
      as: "runs",
    });
    // foreign key on Run, run.scheduleId, run.schedule
    Run.belongsTo(Schedule, {
      foreignKey: {
        name: "scheduleId",
        allowNull: false,
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

    this.Run = Run;
    this.Schedule = Schedule;
    this.Worker = Worker;
  }

  protected async getDbRuns() {
    const runs = await Run.findAll({
      order: [["createdAt", "DESC"]],
    });
    return runs;
  }
  protected async getDbSchedules(where?: WhereOptions<Schedule>) {
    const jobs = await Schedule.findAll({
      order: [["createdAt", "DESC"]],
      where,
      include: {
        model: Run,
        as: "lastRun",
      },
    });
    return jobs;
  }
  protected getJobDef(id: string, version: number): JobDefinition {
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
            jobSchedule,
            await this.getHandler(
              jobSchedule.handlerId,
              jobSchedule.handlerVersion,
              workers
            )
          );
        })
      );
    }

    const jobSchedule = await Schedule.findByPk(scheduleId);
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
    const definition = await this.getHandler(
      schedule.handlerId,
      schedule.handlerVersion
    );
    return createPublicJobRun(run, schedule, definition);
  }

  public async reset(): Promise<void> {
    await Run.truncate({
      cascade: true,
    });
    await Schedule.truncate({
      cascade: true,
    });
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
      include: {
        model: Run,
        as: "lastRun",
      },
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
    handlerId: string
  ): Promise<PublicJobDefinition> {
    const handlers = await this.getLatestHandlers();
    const handler = handlers.find((h) => h.id === handlerId);
    if (!handler) {
      throw new Error("invalid handlerId or the worker is not online");
    }
    return handler;
  }

  public async getLatestHandlers(): Promise<PublicJobDefinition[]> {
    const handlerMap: Record<
      string,
      { def: PublicJobDefinition; version: number } | undefined
    > = {};
    (await this.getWorkers())
      .filter((worker) => {
        return worker.status === WorkerStatus.UP;
      })
      .forEach((worker) => {
        return worker.definitions.forEach((def: PublicJobDefinition) => {
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

  public async registerWorker(attempt = 0): Promise<Worker> {
    log(`Registering this worker (attempt: ${attempt}`);
    try {
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
        const hashes: string[] = [];
        workers.forEach((worker) => {
          version = Math.max(worker.version, version);
          hashes.push(
            createWorkerHash(
              worker.title,
              worker.description,
              worker.pollInterval,
              worker.definitions
            )
          );
        });

        const thisWorkerHash = createWorkerHash(
          this.workerInstance.title,
          this.workerInstance.description,
          this.tickDuration,
          this.getPublicHandlers()
        );

        if (hashes.length > 0 && !hashes.includes(thisWorkerHash)) {
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
          },
          transaction,
        });
        worker.version = version;
        worker.lastReached = new Date();
        await worker.save({ transaction });
        return worker;
      });

      // If the execution reaches this line, the transaction has been committed successfully
      // `result` is whatever was returned from the transaction callback (the `user`, in this case)
    } catch (error) {
      if (attempt >= 3) {
        console.log("Failed to register worker after 3 attempts");
        throw error;
      }
      await new Promise((resolve) => {
        setTimeout(resolve, 1000);
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
    });
    let status: "created" | "updated" | "unchanged" = "unchanged";
    const [schedule, created] = result;
    if (created) {
      status = "created";
    }
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
    const schedule = await Schedule.findByPk(scheduleId);
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
        returning: true,
        where: {
          [Op.and]: [
            {
              handlerId: {
                [Op.in]: jobKeys,
              },
              claimed: {
                [Op.eq]: false,
              },
            },
            {
              [Op.or]: [
                {
                  runAt: {
                    [Op.lte]: new Date(),
                  },
                },
                {
                  runNow: {
                    [Op.eq]: true,
                  },
                },
              ],
            },
            {
              [Op.or]: [
                {
                  workerId: {
                    // eslint-disable-next-line @typescript-eslint/no-non-null-assertion
                    [Op.eq]: null!,
                  },
                },
                {
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
    {
      dontRegisterWorker = false,
      dontMigrate = false,
    }: { dontMigrate?: boolean; dontRegisterWorker?: boolean } = {
      dontMigrate: false,
      dontRegisterWorker: false,
    }
  ) {
    if (!dontMigrate) {
      log("Migrating the database");
      await this.sequelize.sync();
    }
    if (!dontRegisterWorker) {
      await this.registerWorker();
    }
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

  protected async runSchedule(scheduleId: number) {
    const schedule = await Schedule.findByPk(scheduleId);
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

  public async updateSchedule(
    updatePayload: z.output<typeof ScheduleUpdatePayloadSchema>
  ) {
    const schedule = await Schedule.findByPk(updatePayload.id);
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

  private async runDbSchedule(schedule: Schedule) {
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
    const definition = this.getJobDef(schedule.handlerId, schedule.handlerVersion);
    const data: any = definition.dataSchema.parse(JSON.parse(schedule.data));
    return this.runDefinition({
      definitionId: schedule.handlerId,
      data,
      version: schedule.handlerVersion,
    });
    /* eslint-enable */
  }

  public async runDefinition(runMessage: RunHandlerInCp) {
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
    let exitSignal = "0";
    try {
      log("Creating a worker process to run", runMessage.definitionId);
      exitSignal = await this.fork(runMessage, streamHandle);
    } catch (err) {
      _console.error(err);
      exitSignal = "1";
    }
    stdoutStream.end();
    stderrStream.end();
    const [stdout, stderr] = await Promise.all(promises);
    return { stdout, stderr, exitSignal };
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
      const definition = this.getJobDef(
        runMessage.definitionId,
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
          const { definitionId, data, version } =
            RunHandlerInCpSchema.parse(message);
          const definition = this.getJobDef(definitionId, version);
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
    const definition = this.getJobDef(schedule.handlerId, schedule.handlerVersion);
    log(
      "Will run",
      definition.title,
      "according to the",
      schedule.title,
      "schedule"
    );
    const startedAt = new Date();
    const { stderr, stdout, exitSignal } = await this.runDbSchedule(schedule);
    const finishedAt = new Date();
    log(
      "Finished running",
      definition.title,
      "according to the",
      schedule.title,
      "schedule",
      "and it took",
      `${String(finishedAt.getTime() - startedAt.getTime())}ms`
    );

    /**
     * It is new Date if the runNow: true was used on the schedule
     */
    const runAt = schedule.runAt ?? new Date();

    const run = await schedule.createRun(
      {
        scheduledToRunAt: runAt,
        startedAt,
        stderr,
        stdout,
        finishedAt,
        data: schedule.data,
        exitSignal,
        workerId: (await this.registerWorker()).id,
      },
      {
        include: {
          model: Worker,
          as: "worker",
        },
      }
    );
    await run.reload({ include: { model: Worker, as: "worker" } });
    log(
      `Storing the stdout and stderr from the job (${definition.title} @ ${schedule.title})`
    );
    schedule.numRuns += 1;
    await schedule.setLastRun(run);
    await schedule.save();

    const worker = await this.registerWorker();
    await worker.setLastRun(run);
    await worker.save();

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
                this.getJobDef(schedule.handlerId, schedule.handlerVersion).title
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
                  this.getJobDef(schedule.handlerId, schedule.handlerVersion)
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
        const runAt = parseExpression(schedule.cronExpression).next().toDate();
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
    }
    /* eslint-enable no-await-in-loop */
    return claimed;
  }
  public async deleteSchedules(scheduleIds: number[]) {
    await Schedule.destroy({ where: { id: scheduleIds } });
    return scheduleIds;
  }
  public async deleteSchedule(scheduleId: number) {
    const schedule = await Schedule.findByPk(scheduleId);
    if (!schedule) {
      throw new Error("invalid scheduleId");
    }
    const jobDef = this.getJobDef(schedule.handlerId, schedule.handlerVersion);
    const publicSchedule = createPublicJobSchedule(
      schedule,
      createPublicJobDefinition(jobDef)
    );

    await schedule.destroy();

    return publicSchedule;
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
  public getJobDef(id: string, version: number) {
    return super.getJobDef(id, version);
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
}
