import { z } from "zod";

export const publicJobDefinitionSchema = z.object({
  id: z.string(),
  description: z.string(),
  title: z.string(),
  example: z.unknown(),
  codeBlock: z.string(),
  jsonSchema: z.record(z.unknown()),
});

export const DateSchema = z.string().transform((val) => new Date(val));
export const OptionalDateSchema = z
  .string()
  .optional()
  .transform((val) => (val ? new Date(val) : undefined));

export const serializedRunSchema = z.object({
  id: z.number(),
  stdout: z.string(),
  stderr: z.string(),
  createdAt: DateSchema,
  finishedAt: DateSchema,
  startedAt: DateSchema,
  scheduledToRunAt: DateSchema,
  data: z.string(),
});

export const publicJobScheduleSchema = z.object({
  id: z.number(),
  description: z.string(),
  title: z.string(),
  runAt: OptionalDateSchema,
  cronExpression: z.string().optional(),
  lastRun: serializedRunSchema.optional(),
  createdAt: DateSchema,
  target: z.string(),
  jobDefinition: publicJobDefinitionSchema,
  numRuns: z.number(),
  data: z.string(),
});

export const publicJobRunSchema = serializedRunSchema.and(
  z.object({
    jobSchedule: publicJobScheduleSchema,
  })
);

export interface PublicJobDefinition {
  id: string;
  description: string;
  title: string;
  example?: unknown;
  codeBlock: string;
  jsonSchema: Record<string, unknown>;
}

export interface PublicJobSchedule {
  id: number;
  description: string;
  title: string;
  runAt?: Date;
  cronExpression?: string;
  lastRun?: SerializedRun;
  createdAt: Date;
  /** job definition target */
  target: string;
  jobDefinition: PublicJobDefinition;
  numRuns: number;
  data: string;
}
export interface SerializedRun {
  id: number;
  stdout: string;
  stderr: string;
  createdAt: Date;
  finishedAt: Date;
  startedAt: Date;
  scheduledToRunAt: Date;
  data: string;
}
export type PublicJobRun = SerializedRun & {
  jobSchedule: PublicJobSchedule;
};

export interface ScheduleJobOptions {
  cronExpression?: string;
  runAt?: Date;
  eventId?: string;
  title: string;
  description: string;
}

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
  description: z.string().optional(),
});

export type ScheduleUpdatePayload = z.infer<typeof scheduleUpdatePayloadSchema>;
