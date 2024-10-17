import type { ZodType } from "zod";
import { z } from "zod";

// eslint-disable-next-line @typescript-eslint/no-unused-vars
export const typeAssert = <T, U extends T>() => {
  // do nothing
};

//#region Enums
export enum ScheduleStatus {
  RETRYING = "RETRYING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  UNSCHEDULED = "UNSCHEDULED",
  SCHEDULED = "SCHEDULED",
  RUNNING = "RUNNING",
}
export enum WorkerStatus {
  UP = "UP",
  DOWN = "DOWN",
  PENDING = "PENDING",
}
export enum RunStatus {
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  RUNNING = "RUNNING",
  LOST = "LOST",
}
//#endregion

export const DateStringSchema = z.string().refine((dateString) => {
  return (
    dateString.includes("Z") ||
    dateString.includes("+") ||
    dateString.includes("−") || // https://en.wikipedia.org/wiki/Minus_sign
    dateString.includes("-") //    https://en.wikipedia.org/wiki/Hyphen-minus
  );
});

export const DateSchema = z
  .union([DateStringSchema, z.date()])
  .transform((val) => {
    if (typeof val === "string") {
      return new Date(val);
    }
    return val;
  });
export const OptionalDateSchema = z
  .union([DateStringSchema, z.date()])
  .optional()
  .transform((val) => {
    if (val) {
      if (typeof val === "string") {
        return new Date(val);
      }
      return val;
    }
    return undefined;
  });

//#region Schemas
export const serializedRunSchema = z.object({
  id: z.number(),
  stdout: z.string(),
  stderr: z.string(),
  createdAt: DateSchema,
  exitSignal: z.string().optional(),
  finishedAt: OptionalDateSchema,
  startedAt: DateSchema,
  scheduledToRunAt: DateSchema,
  data: z.string(),
  status: z.nativeEnum(RunStatus),
});
export type SerializedRun = z.output<typeof serializedRunSchema>;
//#endregion

//#region WorkerAccess
export const WorkerAccessSchema = z.object({
  view: z
    .object({
      users: z.array(z.string()).optional(),
      groups: z.array(z.string()).optional(),
    })
    .optional(),
  delete: z
    .object({
      users: z.array(z.string()).optional(),
      groups: z.array(z.string()).optional(),
    })
    .optional(),
});
export type WorkerAccess = z.output<typeof WorkerAccessSchema>;
//#endregion

//#region FunctionAccess
export const FunctionAccessSchema = z.object({
  view: z
    .object({
      users: z.array(z.string()).optional(),
      groups: z.array(z.string()).optional(),
    })
    .optional(),
  createSchedule: z
    .object({
      users: z.array(z.string()).optional(),
      groups: z.array(z.string()).optional(),
    })
    .optional(),
});
export type FunctionAccess = z.output<typeof FunctionAccessSchema>;
//#endregion

//#region ScheduleAccess
export const ScheduleAccessSchema = z.object({
  view: z
    .object({
      users: z.array(z.string()).optional(),
      groups: z.array(z.string()).optional(),
    })
    .optional(),
  edit: z
    .object({
      users: z.array(z.string()).optional(),
      groups: z.array(z.string()).optional(),
    })
    .optional(),
  delete: z
    .object({
      users: z.array(z.string()).optional(),
      groups: z.array(z.string()).optional(),
    })
    .optional(),
});
export type ScheduleAccess = z.output<typeof ScheduleAccessSchema>;
//#endregion

//#region RunAccess
export const RunAccessSchema = z.object({
  view: z
    .object({
      users: z.array(z.string()).optional(),
      groups: z.array(z.string()).optional(),
    })
    .optional(),
  viewLogs: z
    .object({
      users: z.array(z.string()).optional(),
      groups: z.array(z.string()).optional(),
    })
    .optional(),
  delete: z
    .object({
      users: z.array(z.string()).optional(),
      groups: z.array(z.string()).optional(),
    })
    .optional(),
});
export type RunAccess = z.output<typeof RunAccessSchema>;
//#endregion

//#region PublicJobDefinition
export const publicJobDefinitionSchema = z.object({
  id: z.string(),
  version: z.number(),
  description: z.string(),
  title: z.string(),
  example: z.unknown(),
  codeBlock: z.string(),
  jsonSchema: z.record(z.unknown()),
  access: nullishToUndefined(FunctionAccessSchema),
  defaultScheduleAccess: nullishToUndefined(ScheduleAccessSchema),
  defaultRunAccess: nullishToUndefined(RunAccessSchema),
});
export type PublicJobDefinition = z.infer<typeof publicJobDefinitionSchema>;
//#endregion

//#region PublicJobSchedule
export const publicJobScheduleSchema = z.object({
  id: z.number(),
  description: z.string(),
  title: z.string(),
  retryFailedJobs: z.boolean(),
  retries: z.number(),
  maxRetries: z.number(),
  runAt: OptionalDateSchema,
  cronExpression: z.string().optional(),
  /**
   * When clicking the run now button this is true to be claimed by a worker asap
   */
  runNow: z.boolean(),
  lastRun: serializedRunSchema.optional(),
  createdAt: DateSchema,
  /** job definition handlerId */
  handlerId: z.string(),
  jobDefinition: z.union([publicJobDefinitionSchema, z.string()]),
  numRuns: z.number(),
  data: z.string(),
  status: z.nativeEnum(ScheduleStatus),
  /**
   * more like schedule id, but the unique ID that ensures that 2 schedules with the same eventId are not created
   */
  eventId: z.string().optional(),
  defaultRunAccess: nullishToUndefined(RunAccessSchema),
});
export type PublicJobSchedule = z.infer<typeof publicJobScheduleSchema>;
//#endregion

export const ScheduleJobResultSchema = z.object({
  schedule: publicJobScheduleSchema,
  status: z.union([
    z.literal("updated"),
    z.literal("created"),
    z.literal("unchanged"),
  ]),
});
export type ScheduleJobResult = z.output<typeof ScheduleJobResultSchema>;

function nullishToUndefined<T extends ZodType>(value: T) {
  return value.nullish().transform((v): z.output<T> | undefined => {
    // eslint-disable-next-line @typescript-eslint/no-unsafe-return
    return v ?? undefined;
  });
}

//#region PublicWorker
export const PublicWorkerSchema = z.object({
  id: z.number(),
  title: z.string(),
  description: z.string().optional(),
  workerId: z.string(),
  instanceId: z.string(),
  version: z.number(),
  hostname: z.string(),
  lastReached: DateSchema,
  createdAt: DateSchema,
  pollInterval: z.number(),
  definitions: z.array(publicJobDefinitionSchema),
  runs: z.array(serializedRunSchema),
  lastRun: serializedRunSchema.optional(),
  status: z.nativeEnum(WorkerStatus),
  versionHash: z.string(),
  defaultFunctionAccess: nullishToUndefined(FunctionAccessSchema),
  defaultScheduleAccess: nullishToUndefined(ScheduleAccessSchema),
  defaultRunAccess: nullishToUndefined(RunAccessSchema),
  access: nullishToUndefined(WorkerAccessSchema),
});
export type PublicWorker = z.infer<typeof PublicWorkerSchema>;
//#endregion

//#region PublicJobRun
export const publicJobRunSchema = serializedRunSchema.and(
  z.object({
    jobSchedule: z.union([publicJobScheduleSchema, z.string()]),
    jobDefinition: z.union([publicJobDefinitionSchema, z.string()]),
    worker: z.union([PublicWorkerSchema, z.string()]),
  })
);
export type PublicJobRun = z.output<typeof publicJobRunSchema>;
//#endregion

//#region ScheduleJobOptions
export const ScheduleJobOptionsSchema = z.object({
  cronExpression: z.string().optional(),
  runAt: OptionalDateSchema,
  eventId: z.string().optional(),
  title: z.string(),
  description: z.string(),
  retryFailedJobs: z.boolean().optional(),
  maxRetries: z.number().optional(),
  failureTrigger: z.number().optional(),
  workerId: z.string().optional(),
  defaultRunAccess: nullishToUndefined(RunAccessSchema),
  access: nullishToUndefined(ScheduleAccessSchema),
});
export type ScheduleJobOptions = z.output<typeof ScheduleJobOptionsSchema>;
//#endregion

//#region ScheduleUpdatePayload
export const ScheduleUpdatePayloadSchema = z.object({
  id: z.number().int().positive(),
  runAt: z
    .union([z.date(), DateStringSchema])
    .optional()
    .nullable()
    .transform((value) => {
      if (typeof value === "string") {
        return new Date(value);
      }
      if (value instanceof Date) {
        return value;
      }
      return value;
    }),
  title: z.string().optional(),
  data: z.string().optional(),
  description: z.string().optional(),
  retryFailedJobs: z.boolean().optional(),
  maxRetries: z.number().optional(),
});
export type ScheduleUpdatePayload = z.infer<typeof ScheduleUpdatePayloadSchema>;
//#endregion

//#region Interfaces

export const RunHandlerInCpSchema = z.object({
  handlerId: z.string(),
  data: z.unknown(),
  version: z.number(),
});

export type RunHandlerInCp = z.output<typeof RunHandlerInCpSchema>;
//#endregion

const StringToOptionalPositiveIntSchema = z
  .string()
  .optional()
  .transform((value, ctx) => {
    if (typeof value === "undefined") {
      return undefined;
    }
    const parsed = parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Not a number",
      });
      return z.NEVER;
    }
    if (parsed <= 0 || !Number.isInteger(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Not a postive integer",
      });
      return z.NEVER;
    }
    return parsed;
  });

export type ListRunsOptions = z.output<typeof ListRunsOptionsSerializedSchema>;

export const ListRunsOptionsSerializedSchema = z.object({
  scheduleId: StringToOptionalPositiveIntSchema,
  order: z
    .string()
    .optional()
    .transform((value, ctx): [string, "DESC" | "ASC"][] | undefined => {
      if (typeof value === "undefined") {
        return undefined;
      }
      const matches = /^(?:[^-]+-(?:ASC|DESC),?)*$/g;
      const result = matches.exec(value.replace(/,$/, ""));
      if (!result) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid order format",
        });
        return z.NEVER;
      }
      if (result[0] === "") {
        return [];
      }
      return result[0].split(",").map((colValue) => {
        const [colId, order] = colValue.split("-");
        return [
          colId,
          z.union([z.literal("ASC"), z.literal("DESC")]).parse(order),
        ];
      });
    }),
  limit: StringToOptionalPositiveIntSchema,
  offset: StringToOptionalPositiveIntSchema,
  authHeader: z.string(),
});

export const ListRunsOptionsSerialize = (
  ob: ListRunsOptions
): z.input<typeof ListRunsOptionsSerializedSchema> => {
  return {
    scheduleId: ob.scheduleId ? String(ob.scheduleId) : undefined,
    order: ob.order
      ? ob.order
          .map(([id, sorting]) => {
            return `${id}-${sorting}`;
          })
          .join(",")
      : undefined,
    limit: ob.limit ? String(ob.limit) : undefined,
    offset: ob.offset ? String(ob.offset) : undefined,
    authHeader: ob.authHeader,
  };
};

/**
 * rename to handler
 */
export interface JobDefinition<T extends ZodType = ZodType> {
  dataSchema: T;
  id: string;
  title: string;
  description: string;
  job: (data: z.infer<T>) => Promise<void> | void;
  example: z.infer<T>;
  version: number;
  access?: FunctionAccess;
  defaultScheduleAccess?: RunAccess;
  defaultRunAccess?: RunAccess;
}
export const JobDefinitionSchema = z.object({
  dataSchema: z.any(),
  id: z.string(),
  title: z.string(),
  description: z.string(),
  job: z.any(),
  example: z.any(),
  version: z.number().int().positive(),
  access: nullishToUndefined(FunctionAccessSchema),
  defaultScheduleAccess: nullishToUndefined(ScheduleAccessSchema),
  defaultRunAccess: nullishToUndefined(RunAccessSchema),
});
typeAssert<keyof JobDefinition, keyof z.output<typeof JobDefinitionSchema>>();
typeAssert<keyof z.output<typeof JobDefinitionSchema>, keyof JobDefinition>();

//#region API types
export const ScheduleSchema = z.object({
  handlerId: z.string(),
  handlerVersion: z.number().int().positive(),
  data: z.unknown(),
  options: ScheduleJobOptionsSchema,
});
export const SchedulesFilterSchema = z.object({
  handlerId: z.string().optional(),
  eventId: z.string().optional(),
});
//#endregion

export const UserSchema = z.object({
  id: z.number(),
  username: z.string(),
  email: nullishToUndefined(z.string()),
  name: z.string(),
  admin: z.coerce.boolean(),
  createdAt: z.coerce.date(),
});
