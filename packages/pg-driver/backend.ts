import * as cp from "node:child_process";
import stream from "node:stream";
import type {
  JobDefinition,
  ListRunsOptions,
  PublicJobDefinition,
  PublicJobRun,
  PublicJobSchedule,
  RunDefinition,
  ScheduleJobOptions,
  ScheduleUpdatePayloadSchema,
  SerializedRun,
} from "@enschedule/types";
import { ScheduleStatus } from "@enschedule/types";
import { parseExpression } from "cron-parser";
import { pascalCase } from "pascal-case";
import type {
  Association,
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
  jobDef: JobDefinition | string
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
    target: schedule.target,
    createdAt: schedule.createdAt,
    jobDefinition:
      typeof jobDef === "string" ? jobDef : createPublicJobDefinition(jobDef),
    numRuns: schedule.numRuns,
    data: schedule.data,
    status,
  };
};

export const createPublicJobRun = (
  run: Run,
  schedule: Schedule,
  jobDef: JobDefinition | string
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
}
// eslint-disable-next-line @typescript-eslint/no-unused-vars
const assert = <T, U extends T>() => {
  //
};
assert<
  // omit desc and title because they are passed as argumnets to createJobSchedule
  Omit<ScheduleJobOptions, "description" | "title">,
  CreateJobScheduleOptions
>();

type ScheduleAttributes = InferAttributes<
  Schedule,
  { omit: "runs" | "lastRun" }
>;

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
  declare title: string;
  declare description: string;
  /** job definition target, i.e. the definition that the schedule executes */
  declare target: string;
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

  declare failureTriggerId: ForeignKey<Schedule["id"]>;

  declare getFailureTrigger: HasOneGetAssociationMixin<Schedule | null>; // Note the null assertions!
  declare setFailureTrigger: HasOneSetAssociationMixin<Schedule, number>;
  declare createFailureTrigger: HasOneCreateAssociationMixin<Schedule>;

  declare failureTrigger: NonAttribute<Schedule>;

  declare static associations: {
    runs: Association<Schedule, Run>;
    lastRun: Association<Schedule, Run>;
  };
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

  declare getSchedule: HasOneGetAssociationMixin<Schedule>; // Note the null assertions!
  declare setSchedule: HasOneSetAssociationMixin<Schedule, number>;
  declare createSchedule: HasOneCreateAssociationMixin<Schedule>;

  declare schedule: NonAttribute<Schedule>;
}

export const createJobDefinition = <T extends ZodType = ZodType>(
  job: JobDefinition<T>
) => job;

export interface BackendOptions {
  database?: SeqConstructorOptions;
  forkArgv?: string[];
}

export class PrivateBackend {
  protected maxJobsPerTick = 4;
  protected tickDuration = 5000;
  public logJobs = false;
  protected sequelize: Sequelize;
  protected Run: typeof Run;
  protected Schedule: typeof Schedule;
  private forkArgv: string[] | undefined;

  constructor(backendOptions: BackendOptions) {
    const { database: passedDatabaseOptions, forkArgv } = backendOptions;
    const database = passedDatabaseOptions ?? envSequalizeOptions();
    this.forkArgv = forkArgv;

    const sequelize = database.uri
      ? new Sequelize(database.uri, database)
      : new Sequelize(database);

    this.sequelize = sequelize;

    Schedule.init(
      {
        id: {
          type: DataTypes.INTEGER,
          autoIncrement: true,
          primaryKey: true,
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
        target: {
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

    Schedule.hasMany(Run, {
      foreignKey: {
        name: "scheduleId",
        allowNull: false,
      },
      as: "runs",
    });
    Run.belongsTo(Schedule, {
      as: "schedule",
    });

    Schedule.hasOne(Run, {
      as: "lastRun",
    });

    Schedule.belongsTo(Schedule, {
      foreignKey: {
        name: "failureTriggerId",
        allowNull: true,
      },
      as: "failureTrigger",
    });

    this.Run = Run;
    this.Schedule = Schedule;
  }

  protected async getDbRuns() {
    const runs = await Run.findAll({
      order: [["createdAt", "DESC"]],
    });
    return runs;
  }
  protected async getDbSchedules() {
    const jobs = await Schedule.findAll({
      order: [["createdAt", "DESC"]],
      include: {
        model: Run,
        as: "lastRun",
      },
    });
    return jobs;
  }
  protected getJobDef(id: string): JobDefinition {
    const def = this.definedJobs[id];
    if (!def) {
      throw new Error("invalid id");
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
        include: {
          model: Schedule,
          as: "schedule",
        },
      });
      return runs.map((run) => {
        const jobSchedule = run.schedule;
        return createPublicJobRun(
          run,
          jobSchedule,
          this.definedJobs[jobSchedule.target] || jobSchedule.target
        );
      });
    }

    const jobSchedule = await Schedule.findByPk(scheduleId);
    if (!jobSchedule) {
      throw new Error("invalid jobScheduleId");
    }
    const runs = await jobSchedule.getRuns({ limit, order, offset });
    return runs.map((run) =>
      createPublicJobRun(
        run,
        jobSchedule,
        this.definedJobs[jobSchedule.target] || jobSchedule.target
      )
    );
  }
  public async getRun(runId: number): Promise<PublicJobRun> {
    const run = await Run.findByPk(runId);
    if (!run) {
      throw new Error("invalid runId");
    }
    const schedule = await run.getSchedule({
      include: {
        model: Run,
        as: "lastRun",
      },
    });
    const definition = this.definedJobs[schedule.target] || schedule.target;
    return createPublicJobRun(run, schedule, definition);
  }

  public async reset(): Promise<void> {
    await Run.truncate({
      cascade: true,
    });
    await Schedule.truncate({
      cascade: true,
    });
    // await this.sequelize.sync({ force: true });
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
    return createPublicJobSchedule(
      schedule,
      this.definedJobs[schedule.target] || schedule.target
    );
  }
  public getDefinitions(): PublicJobDefinition[] {
    return Object.values(this.definedJobs)
      .filter((value): value is JobDefinition => Boolean(value))
      .map((def) => createPublicJobDefinition(def));
  }
  public async getSchedules(definitionId?: string) {
    if (definitionId) {
      this.getJobDefinition(definitionId);
    }
    const dbSchedules = await this.getDbSchedules();
    return dbSchedules
      .filter((schedule) => {
        if (definitionId) {
          if (definitionId !== schedule.target) {
            return false;
          }
        }
        return Boolean(this.definedJobs[schedule.target]);
      })
      .map((schedule) => {
        const jobDef = this.definedJobs[schedule.target] || schedule.target;
        return createPublicJobSchedule(schedule, jobDef);
      });
  }

  protected createSignature(
    jobId: string,
    runAt: Date | undefined,
    data: unknown,
    cronExpression: string | undefined
  ): string {
    const rounded = runAt
      ? Math.floor(runAt.getTime() / 1000) * 1000
      : "manual";
    let signature = `${jobId}-${rounded}-${JSON.stringify(data)}`;
    if (cronExpression) {
      signature += `-${parseExpression(cronExpression).stringify(true)}`;
    }
    return signature;
  }
  protected async createJobSchedule(
    defId: string,
    title: string,
    description: string,
    data: unknown,
    options: CreateJobScheduleOptions = {}
  ) {
    const def = this.definedJobs[defId];
    if (!def) {
      throw new Error("You must create a JobDefinition first");
    }
    const {
      cronExpression,
      eventId,
      runAt,
      retryFailedJobs,
      maxRetries,
      failureTrigger,
    } = options;
    const signature = this.createSignature(defId, runAt, data, cronExpression);
    const where: WhereOptions<ScheduleAttributes> = eventId
      ? {
          eventId,
          claimed: false,
        }
      : {
          signature,
          claimed: false,
        };
    return Schedule.findOrCreate({
      where,
      defaults: {
        retryFailedJobs,
        maxRetries,
        target: defId,
        // normalize the cron expression
        cronExpression: cronExpression
          ? parseExpression(cronExpression).stringify(true)
          : undefined,
        runAt,
        data: JSON.stringify(data),
        signature,
        title,
        description,
        failureTriggerId: failureTrigger,
      },
    });
  }
  public getJobDefinition(definitionId: string): PublicJobDefinition {
    const jobDef = this.definedJobs[definitionId];
    if (!jobDef) {
      throw new Error("invalid definitionId");
    }
    return createPublicJobDefinition(jobDef);
  }

  public async scheduleJob(
    jobId: string,
    data: unknown,
    options?: ScheduleJobOptions
  ): Promise<PublicJobSchedule>;
  public async scheduleJob<T extends ZodType = ZodType>(
    job: JobDefinition<T>,
    data: z.infer<T>,
    options?: ScheduleJobOptions
  ): Promise<PublicJobSchedule>;
  public async scheduleJob(
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    def: string | JobDefinition<any>,
    data: unknown,
    options: ScheduleJobOptions
  ): Promise<PublicJobSchedule> {
    const defId = typeof def === "string" ? def : def.id;
    if (!this.definedJobs[defId]) {
      throw new Error("You have not declared / registered a job with this id");
    }

    let runAt: Date | undefined = options.runAt;
    const cronExpression: string | undefined = options.cronExpression;

    if (cronExpression) {
      runAt = parseExpression(cronExpression).next().toDate();
    }

    const { retryFailedJobs, maxRetries, failureTrigger } = options;

    const [dbSchedule] = await this.createJobSchedule(
      defId,
      options.title,
      options.description,
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
    return createPublicJobSchedule(
      dbSchedule,
      this.definedJobs[dbSchedule.target] || dbSchedule.target
    );
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
    // only fetch jobs for a server that has a job definition for the schedule target
    const jobKeys = Object.keys(this.definedJobs);
    if (jobKeys.length === 0) {
      throw new Error("You have no registered jobs on this client");
    }
    const overdueJobs = await Schedule.update(
      {
        claimed: true,
        runNow: false,
      },
      {
        limit: this.maxJobsPerTick,
        returning: true,
        where: {
          [Op.and]: [
            {
              target: {
                [Op.any]: jobKeys,
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
          ],
        },
      }
    );
    return { overdueJobs };
  }

  protected definedJobs: Record<string, undefined | JobDefinition> = {};

  public registerJob<T extends ZodType = ZodType>(job: JobDefinition<T>) {
    const id = job.id;
    if (this.definedJobs[id]) {
      throw new Error(
        "You have already declared / registered a job with this id"
      );
    }
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    this.definedJobs[id] = job as JobDefinition<any>;
    return job;
  }

  public async migrate() {
    log("Migrating the database");
    await this.sequelize.sync();
  }

  public async startPolling(
    settings: { dontMigrate: boolean } = {
      dontMigrate: false,
    }
  ) {
    if (!settings.dontMigrate) {
      log("Migrating the database");
      await this.sequelize.sync();
    }
    log("Polling the database for jobs");
    const now = Date.now();
    setTimeout(() => {
      setInterval(() => {
        void this.tick();
      }, this.tickDuration);
    }, 1000 - (now - Math.floor(now / 1000) * 1000));
  }

  protected async tick() {
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
      this.definedJobs[schedule.target] || schedule.target
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
      this.definedJobs[schedule.target] || schedule.target
    );
  }

  private async runDbSchedule(schedule: Schedule) {
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
    const definition = this.getJobDef(schedule.target);
    const data: any = definition.dataSchema.parse(JSON.parse(schedule.data));
    return this.runDefinition({ definitionId: schedule.target, data });
    /* eslint-enable */
  }

  public async runDefinition(runMessage: RunDefinition) {
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
    runMessage: RunDefinition,
    { stdout, stderr, toggleBuffering }: StreamHandle
  ) {
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
            log(
              'There was an error when sending the "done" signal to the child process'
            );
            if (err) {
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
          const { definitionId, data } = z
            .object({
              definitionId: z.string(),
              data: z.unknown(),
            })
            .parse(message);
          const definition = this.getJobDef(definitionId);
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
            });
        });
        log("Child process is ready");
        ps("initialize");
      });
    }
    return false;
  }

  private async scheduleSingleRun(schedule: Schedule) {
    const definition = this.getJobDef(schedule.target);
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

    const run = await schedule.createRun({
      scheduledToRunAt: runAt,
      startedAt,
      stderr,
      stdout,
      finishedAt,
      data: schedule.data,
      exitSignal,
    });
    log(
      `Storing the stdout and stderr from the job (${definition.title} @ ${schedule.title})`
    );
    schedule.numRuns += 1;
    await schedule.setLastRun(run);
    await schedule.save();
    return run;
  }

  public retryStrategy(schedule: PublicJobSchedule) {
    return Math.min(60000 * 2 ** schedule.retries, 5 * 60 * 1000);
  }

  protected async runOverdueJobs() {
    const claimed = await this.claimUnclaimedOverdueJobs();
    const numJobs = claimed.overdueJobs[0];
    const overdueJobs = claimed.overdueJobs[1];
    if (numJobs > 0) {
      log(
        `Claimed ${numJobs} jobs that run in the following definition(schedule):`,
        overdueJobs
          .map(
            (schedule) =>
              `${this.getJobDef(schedule.target).title}${schedule.title}`
          )
          .join(", ")
      );
    }
    await Promise.all(
      overdueJobs.map(async (schedule) => {
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
                  this.getJobDef(schedule.target)
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
      })
    );
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
    const jobDef = this.getJobDef(schedule.target);
    const publicSchedule = createPublicJobSchedule(schedule, jobDef);

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

  public async createJobSchedule(
    jobId: string,
    title: string,
    description: string,
    data: unknown,
    options: CreateJobScheduleOptions = {}
  ) {
    return super.createJobSchedule(jobId, title, description, data, options);
  }
  public async getDbSchedules() {
    return super.getDbSchedules();
  }
  public clearRegisteredJobs() {
    this.definedJobs = {};
  }
  public async getDbRuns() {
    return super.getDbRuns();
  }
  public getJobDef(id: string) {
    return super.getJobDef(id);
  }
  public createConsole(
    stdoutStream: stream.PassThrough,
    stderrStream: stream.PassThrough
  ) {
    return super.createConsole(stdoutStream, stderrStream);
  }
  public async fork(runMessage: RunDefinition, streamHandle: StreamHandle) {
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
    jobId: string,
    runAt: Date,
    data: unknown,
    cronExpression?: string
  ): string {
    return super.createSignature(jobId, runAt, data, cronExpression);
  }

  public async tick() {
    return super.tick();
  }
}
