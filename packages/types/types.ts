import { z } from "zod";

//#region Schemas
export const DateSchema = z.union([z.string(), z.date()]).transform((val) => {
  if (typeof val === "string") {
    return new Date(val);
  }
  return val;
});
export const OptionalDateSchema = z
  .union([z.string(), z.date()])
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
  jobDefinition: publicJobDefinitionSchema,
  numRuns: z.number(),
  data: z.string(),
});
export type PublicJobSchedule = z.infer<typeof publicJobScheduleSchema>;
//#endregion

//#region PublicJobRun
export const publicJobRunSchema = serializedRunSchema.and(
  z.object({
    jobSchedule: publicJobScheduleSchema,
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
  retries: z.number().optional(),
  maxRetries: z.number().optional(),
  failureTrigger: z.number().optional(),
});
export type ScheduleJobOptions = z.output<typeof ScheduleJobOptionsSchema>;
//#endregion

//#region ScheduleUpdatePayload
export const scheduleUpdatePayloadSchema = z.object({
  id: z.number().int().positive(),
  runAt: z
    .union([
      z.date(),
      z.string().refine((dateString) => {
        return (
          dateString.includes("Z") ||
          dateString.includes("+") ||
          dateString.includes("−") || // https://en.wikipedia.org/wiki/Minus_sign
          dateString.includes("-") //    https://en.wikipedia.org/wiki/Hyphen-minus
        );
      }),
    ])
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
});
export type ScheduleUpdatePayload = z.infer<typeof scheduleUpdatePayloadSchema>;
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

export interface RunDefinition {
  definitionId: string;
  data: unknown;
}
//#endregion
