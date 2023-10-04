import stream from "node:stream";
import type {
  PublicJobDefinition,
  PublicJobRun,
  PublicJobSchedule,
  ScheduleJobOptions,
  ScheduleUpdatePayload,
  SerializedRun,
} from "@enschedule/types";
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
import type { z, ZodType } from "zod";
import { zodToJsonSchema } from "zod-to-json-schema";
import { createTypeAlias, printNode, zodToTs } from "zod-to-ts";
import { log } from "./log";

interface JobDefinition<T extends ZodType = ZodType> {
  dataSchema: T;
  id: string;
  title: string;
  description: string;
  job: (data: z.infer<T>, console: Console) => Promise<void> | void;
  example: z.infer<T>;
}

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
    finishedAt: run.finishedAt,
    startedAt: run.startedAt,
    scheduledToRunAt: run.scheduledToRunAt,
    data: run.data,
  };
};

export const createPublicJobSchedule = (
  schedule: Schedule,
  jobDef: JobDefinition
): PublicJobSchedule => {
  return {
    id: schedule.id,
    title: schedule.title,
    description: schedule.description,
    runAt: schedule.runAt || undefined,
    cronExpression: schedule.cronExpression || undefined,
    lastRun: schedule.lastRun ? serializeRun(schedule.lastRun) : undefined,
    target: schedule.target,
    createdAt: schedule.createdAt,
    jobDefinition: createPublicJobDefinition(jobDef),
    numRuns: schedule.numRuns,
    data: schedule.data,
  };
};

export const createPublicJobRun = (
  run: Run,
  schedule: Schedule,
  jobDef: JobDefinition
): PublicJobRun => {
  return {
    id: Number(run.id),
    stdout: run.stdout,
    stderr: run.stderr,
    createdAt: run.createdAt,
    finishedAt: run.finishedAt,
    startedAt: run.startedAt,
    scheduledToRunAt: run.scheduledToRunAt,
    jobSchedule: createPublicJobSchedule(schedule, jobDef),
    data: run.data,
  };
};

type ScheduleAttributes = InferAttributes<
  Schedule,
  { omit: "runs" | "lastRun" }
>;

class Schedule extends Model<
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
  pgUser: string;
  pgPassword: string;
  pgHost: string;
  pgPort: string;
  pgDatabase: string;
}

export class PrivateBackend {
  protected maxJobsPerTick = 4;
  protected tickDuration = 5000;
  public logJobs = false;
  protected sequelize: Sequelize;
  protected Run: typeof Run;
  protected Schedule: typeof Schedule;

  constructor(backendOptions: BackendOptions) {
    const { pgUser, pgPassword, pgHost, pgPort, pgDatabase } = backendOptions;
    const sequelize = new Sequelize(
      `postgres://${pgUser}:${pgPassword}@${pgHost}:${pgPort}/${pgDatabase}`,
      {
        logging: false,
      }
    );
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

    this.Run = Run;
    this.Schedule = Schedule;
  }

  protected async getDbRuns() {
    const runs = await Run.findAll();
    return runs;
  }
  protected async getDbSchedules() {
    const jobs = await Schedule.findAll({
      include: {
        model: Run,
        as: "lastRun",
      },
    });
    return jobs;
  }
  private getJobDef(id: string): JobDefinition {
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
  }: {
    scheduleId?: number;
    order?: [string, "DESC" | "ASC"][];
    limit?: number;
    offset?: number;
  }): Promise<PublicJobRun[]> {
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
        const jobDef = this.getJobDef(jobSchedule.target);
        return createPublicJobRun(run, jobSchedule, jobDef);
      });
    }

    const jobSchedule = await Schedule.findByPk(scheduleId);
    if (!jobSchedule) {
      throw new Error("invalid jobScheduleId");
    }
    const runs = await jobSchedule.getRuns({ limit, order, offset });
    const jobDef = this.getJobDef(jobSchedule.target);
    return runs.map((run) => createPublicJobRun(run, jobSchedule, jobDef));
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
    const definition = this.definedJobs[schedule.target];
    if (!definition) {
      throw new Error("invalid target");
    }
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
    const jobDef = this.getJobDef(schedule.target);
    return createPublicJobSchedule(schedule, jobDef);
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
        const jobDef = this.getJobDef(schedule.target);
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
    options: { cronExpression?: string; eventId?: string; runAt?: Date } = {}
  ) {
    const def = this.definedJobs[defId];
    if (!def) {
      throw new Error("You must create a JobDefinition first");
    }
    const { cronExpression, eventId, runAt } = options;
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

    const [dbSchedule] = await this.createJobSchedule(
      defId,
      options.title,
      options.description,
      data,
      {
        eventId: options.eventId,
        runAt,
        cronExpression,
      }
    );
    return {
      id: Number(dbSchedule.id),
      title: dbSchedule.title,
      description: dbSchedule.description,
      target: dbSchedule.target,
      jobDefinition: this.getJobDefinition(dbSchedule.target),
      lastRun: undefined,
      runAt: dbSchedule.runAt || undefined,
      cronExpression: dbSchedule.cronExpression || undefined,
      createdAt: dbSchedule.createdAt,
      numRuns: dbSchedule.numRuns,
      data: dbSchedule.data,
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
    return createPublicJobRun(run, schedule, this.getJobDef(schedule.target));
  }

  public async updateSchedule(updatePayload: ScheduleUpdatePayload) {
    const schedule = await Schedule.findByPk(updatePayload.id);
    if (!schedule) {
      throw new Error("invalid id in ScheduleUpdatePayload");
    }
    let updated = false;
    if (typeof updatePayload.description === "string") {
      schedule.description = updatePayload.description;
      updated = true;
    }
    if (typeof updatePayload.title === "string") {
      schedule.title = updatePayload.title;
      updated = true;
    }
    if (typeof updatePayload.data === "string") {
      schedule.data = updatePayload.data;
      updated = true;
    }
    if (updatePayload.runAt === null) {
      schedule.runAt = null;
      schedule.claimed = true;
      updated = true;
    } else if (updatePayload.runAt instanceof Date) {
      schedule.runAt = updatePayload.runAt;
      schedule.claimed = false;
      updated = true;
    }
    if (updated) {
      await schedule.save();
    }
    return createPublicJobSchedule(schedule, this.getJobDef(schedule.target));
  }

  private async runDbSchedule(schedule: Schedule) {
    /* eslint-disable @typescript-eslint/no-unsafe-assignment, @typescript-eslint/no-explicit-any */
    const definition = this.getJobDef(schedule.target);
    const data: any = definition.dataSchema.parse(JSON.parse(schedule.data));
    const { Console } = console;
    const output: { stderr: any[]; stdout: any[] } = { stderr: [], stdout: [] };
    const stdoutStream = new stream.PassThrough();
    const stderrStream = new stream.PassThrough();
    const bufferStream = (
      pipeStream: stream.PassThrough,
      key: "stderr" | "stdout"
    ) => {
      const buffer = output[key];
      let _resolve: undefined | ((data: string) => void);
      pipeStream.on("data", (chunk) => {
        buffer.push(chunk);
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

    const _console = new Console({
      stdout: stdoutStream,
      stderr: stderrStream,
      ignoreErrors: true,
      colorMode: false,
    });

    const promises = [
      bufferStream(stdoutStream, "stdout"),
      bufferStream(stderrStream, "stderr"),
    ];

    if (this.logJobs) {
      stdoutStream.pipe(process.stdout, { end: false });
      stderrStream.pipe(process.stderr, { end: false });
    }

    try {
      await definition.job(data, _console);
    } catch (err) {
      _console.error(err);
    }
    stdoutStream.end();
    stderrStream.end();
    const [stdout, stderr] = await Promise.all(promises);
    return { stdout, stderr };
    /* eslint-enable */
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
    const { stderr, stdout } = await this.runDbSchedule(schedule);
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

    const runAt = schedule.runAt ?? new Date();

    const run = await schedule.createRun({
      scheduledToRunAt: runAt,
      startedAt,
      stderr,
      stdout,
      finishedAt,
      data: schedule.data,
    });
    log(
      `Storing the stdout and stderr from the job (${definition.title} @ ${schedule.title})`
    );
    schedule.numRuns += 1;
    void schedule.setLastRun(run);
    await schedule.save();
    return run;
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
        await this.scheduleSingleRun(schedule);

        if (schedule.cronExpression) {
          const runAt = parseExpression(schedule.cronExpression)
            .next()
            .toDate();
          schedule.runAt = runAt;
          schedule.claimed = false;
          await schedule.save();
        }
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
    options: { cronId?: string; eventId?: string; runAt?: Date } = {}
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
