import type { ZodType } from "zod";
import { z } from "zod";

//#region Enums
export enum ScheduleStatus {
  RETRYING = "RETRYING",
  SUCCESS = "SUCCESS",
  FAILED = "FAILED",
  UNSCHEDULED = "UNSCHEDULED",
  SCHEDULED = "SCHEDULED",
}
export enum WorkerStatus {
  UP = "UP",
  DOWN = "DOWN",
  PENDING = "PENDING",
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

//#region Schemas
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

export const serializedRunSchema = z.object({
  id: z.number(),
  stdout: z.string(),
  stderr: z.string(),
  createdAt: DateSchema,
  exitSignal: z.string(),
  finishedAt: DateSchema,
  startedAt: DateSchema,
  scheduledToRunAt: DateSchema,
  data: z.string(),
});
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
  lastRun: serializedRunSchema.optional(),
  createdAt: DateSchema,
  /** job definition target */
  target: z.string(),
  jobDefinition: z.union([publicJobDefinitionSchema, z.string()]),
  numRuns: z.number(),
  data: z.string(),
  status: z.nativeEnum(ScheduleStatus),
});
export type PublicJobSchedule = z.infer<typeof publicJobScheduleSchema>;
//#endregion

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
});
export type PublicWorker = z.infer<typeof PublicWorkerSchema>;
//#endregion

//#region PublicJobRun
export const publicJobRunSchema = serializedRunSchema.and(
  z.object({
    jobSchedule: publicJobScheduleSchema,
    worker: PublicWorkerSchema,
  })
);
export type PublicJobRun = z.infer<typeof publicJobRunSchema>;
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
export interface SerializedRun {
  id: number;
  stdout: string;
  stderr: string;
  createdAt: Date;
  exitSignal: string;
  finishedAt: Date;
  startedAt: Date;
  scheduledToRunAt: Date;
  data: string;
}

export const RunHandlerInCpSchema = z.object({
  definitionId: z.string(),
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
}
