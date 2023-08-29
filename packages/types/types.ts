import { z} from "zod";
import type { ZodType } from "zod";

export interface JobDefinition<T extends ZodType = ZodType> {
  dataSchema: T;
  id: string;
  title: string;
  description: string;
  job: (data: z.infer<T>, console: Console) => Promise<void> | void;
  example: z.infer<T>;
}

export const publicJobDefinitionSchema = z.object({
  id: z.string(),
  description: z.string(),
  title: z.string(),
  dataSchema: z.unknown(),
  example: z.unknown(),
});

export const serializedRunSchema = z.object({
  id: z.number(),
  stdout: z.string(),
  stderr: z.string(),
  createdAt: z.date(),
  finishedAt: z.date(),
  startedAt: z.date(),
  scheduledToRunAt: z.date(),
  data: z.string(),
});

export const publicJobScheduleSchema = z.object({
  id: z.number(),
  description: z.string(),
  title: z.string(),
  runAt: z.union([z.date(), z.undefined()]),
  cronExpression: z.union([z.string(), z.undefined()]),
  lastRun: z.union([serializedRunSchema, z.undefined()]),
  createdAt: z.date(),
  target: z.string(),
  jobDefinition: publicJobDefinitionSchema,
  numRuns: z.number(),
  data: z.string(),
});

export const publicJobRunSchema = serializedRunSchema.and(
  z.object({
    jobSchedule: publicJobScheduleSchema,
  }),
);

// export type PublicJobDefinition = z.infer<typeof publicJobDefinitionSchema>

export interface PublicJobDefinition {
  id: string;
  description: string;
  title: string;
  dataSchema: ZodType;
  example: unknown;
}
export interface PublicJobSchedule {
  id: number;
  description: string;
  title: string;
  runAt: Date | undefined;
  cronExpression: string | undefined;
  lastRun: SerializedRun | undefined;
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
