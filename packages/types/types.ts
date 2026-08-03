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
  // eslint-disable-next-line @typescript-eslint/naming-convention
  NO_WORKER = "NO_WORKER",
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
}, "Date string should include timezone information");

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
  createdAt: DateSchema,
  exitSignal: z.string().optional(),
  finishedAt: OptionalDateSchema,
  startedAt: DateSchema,
  scheduledToRunAt: DateSchema,
  data: z.string().optional(),
  status: z.nativeEnum(RunStatus),
});
export type SerializedRun = z.output<typeof serializedRunSchema>;
//#endregion

//#region Access control
export const GroupKeySchema = z
  .string()
  .min(1)
  .max(64)
  .regex(/^[a-z][a-z0-9-]*$/, "Group keys must start with a lowercase letter and contain only lowercase letters, numbers, and hyphens");
export const GroupGrantSchema = z.object({
  groups: z.array(GroupKeySchema).default([]),
});

export const WorkerAccessSchema = z.object({
  view: GroupGrantSchema.optional(),
  delete: GroupGrantSchema.optional(),
});
export type WorkerAccess = z.output<typeof WorkerAccessSchema>;
export const WorkerCapabilitiesSchema = z.object({ view: z.boolean(), delete: z.boolean() });
export type WorkerCapabilities = z.output<typeof WorkerCapabilitiesSchema>;

export const FunctionAccessSchema = z.object({
  view: GroupGrantSchema.optional(),
  createSchedule: GroupGrantSchema.optional(),
});
export type FunctionAccess = z.output<typeof FunctionAccessSchema>;
export const FunctionCapabilitiesSchema = z.object({ view: z.boolean(), createSchedule: z.boolean() });
export type FunctionCapabilities = z.output<typeof FunctionCapabilitiesSchema>;

export const ScheduleAccessSchema = z.object({
  view: GroupGrantSchema.optional(),
  edit: GroupGrantSchema.optional(),
  run: GroupGrantSchema.optional(),
  delete: GroupGrantSchema.optional(),
});
export type ScheduleAccess = z.output<typeof ScheduleAccessSchema>;
export const ScheduleCapabilitiesSchema = z.object({
  view: z.boolean(),
  edit: z.boolean(),
  run: z.boolean(),
  delete: z.boolean(),
});
export type ScheduleCapabilities = z.output<typeof ScheduleCapabilitiesSchema>;

export const RunAccessSchema = z.object({
  view: GroupGrantSchema.optional(),
  viewLogs: GroupGrantSchema.optional(),
  delete: GroupGrantSchema.optional(),
});
export type RunAccess = z.output<typeof RunAccessSchema>;
export const RunCapabilitiesSchema = z.object({
  view: z.boolean(),
  viewLogs: z.boolean(),
  delete: z.boolean(),
});
export type RunCapabilities = z.output<typeof RunCapabilitiesSchema>;
//#endregion

//#region PublicJobDefinition
export const publicJobDefinitionSchema = z.object({
  id: z.string(),
  version: z.number(),
  description: z.string().optional(),
  title: z.string(),
  example: z.unknown().optional(),
  codeBlock: z.string().optional(),
  jsonSchema: z.record(z.string(), z.unknown()).optional(),
  access: nullishToUndefined(FunctionAccessSchema),
  defaultScheduleAccess: nullishToUndefined(ScheduleAccessSchema),
  defaultRunAccess: nullishToUndefined(RunAccessSchema),
  capabilities: FunctionCapabilitiesSchema,
});
export type PublicJobDefinition = z.infer<typeof publicJobDefinitionSchema>;
//#endregion

//#region PublicJobSchedule
export const publicJobScheduleSchema = z.object({
  id: z.number(),
  description: z.string().optional(),
  title: z.string(),
  retryFailedJobs: z.boolean(),
  retries: z.number(),
  maxRetries: z.number(),
  runAt: OptionalDateSchema,
  cronExpression: z.string().optional(),
  /**
   * When clicking the run now button this is true to be claimed by a worker asap
   */
  runNow: z.coerce.boolean(),
  lastRun: serializedRunSchema.optional(),
  createdAt: DateSchema,
  /** job definition functionId */
  functionId: z.string(),
  jobDefinition: z.union([publicJobDefinitionSchema, z.string()]),
  numRuns: z.number(),
  data: z.string().optional(),
  status: z.nativeEnum(ScheduleStatus),
  /**
   * more like schedule id, but the unique ID that ensures that 2 schedules with the same eventId are not created
   */
  eventId: z.string().optional(),
  defaultRunAccess: nullishToUndefined(RunAccessSchema),
  capabilities: ScheduleCapabilitiesSchema,
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
  capabilities: WorkerCapabilitiesSchema,
});
export type PublicWorker = z.infer<typeof PublicWorkerSchema>;
//#endregion

//#region PublicJobRun
export const publicJobRunSchema = serializedRunSchema.and(
  z.object({
    jobSchedule: z.union([publicJobScheduleSchema, z.string()]),
    jobDefinition: z.union([publicJobDefinitionSchema, z.string()]),
    worker: z.union([PublicWorkerSchema, z.string()]).optional(),
    capabilities: RunCapabilitiesSchema,
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
  description: z.string().optional(),
  retryFailedJobs: z.boolean().optional(),
  maxRetries: z.number().optional(),
  failureTrigger: z.number().optional(),
  workerId: z.string().optional(),
  defaultRunAccess: nullishToUndefined(RunAccessSchema),
  access: nullishToUndefined(ScheduleAccessSchema),
  runNow: z.boolean().optional(),
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
  description: z.string().optional().nullable(), // set to null to clear, set to undefined to not update
  retryFailedJobs: z.boolean().optional(),
  maxRetries: z.number().optional(),
  runNow: z.boolean().optional(),
});
export type ScheduleUpdatePayload = z.infer<typeof ScheduleUpdatePayloadSchema>;
//#endregion

//#region Interfaces

export const RunHandlerInCpSchema = z.object({
  functionId: z.string(),
  /**
   * migrated data
   */
  migratedData: z.unknown(),
  version: z.number(),
});

export type RunHandlerInCp = z.output<typeof RunHandlerInCpSchema>;
//#endregion

const StringToOptionalNonNegativeIntSchema = z
  .union([z.string(), z.number()])
  .transform((value, ctx) => {
    const parsed = typeof value === "number" ? value : parseInt(value, 10);
    if (Number.isNaN(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Not a number",
      });
      return z.NEVER;
    }
    if (parsed < 0 || !Number.isInteger(parsed)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "Not a non-negative integer",
      });
      return z.NEVER;
    }
    return parsed;
  })
  .optional();

export type ListRunsOptions = z.output<typeof ListRunsOptionsSerializedSchema>;

export const AuthHeader = z.custom<`${
  | "Jwt"
  | "Api-Key"
  | "User-Api-Key"} ${string}`>((val) => {
  return typeof val === "string"
    ? /^(?:Jwt|Api-Key|User-Api-Key) .+$/.test(val)
    : false;
});

export const ListRunsOptionsSerializedSchema = z.object({
  scheduleId: StringToOptionalNonNegativeIntSchema.refine((value) => value === undefined || value > 0, "Not a positive integer"),
  order: z
    .union([
      z.string(),
      z.array(z.tuple([z.string(), z.enum(["ASC", "DESC"])])),
    ])
    .transform((value, ctx): [string, "DESC" | "ASC"][] => {
      if (Array.isArray(value)) return value;
      const matches = /^(?:[^-]+-(?:ASC|DESC),?)*$/g;
      const result = matches.exec(value.replace(/,$/, ""));
      if (!result) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          message: "Invalid order format",
        });
        return z.NEVER;
      }
      if (result[0] === "") return [];
      return result[0].split(",").map((colValue) => {
        const [colId, order] = colValue.split("-");
        return [colId!, z.enum(["ASC", "DESC"]).parse(order)];
      });
    })
    .optional(),
  limit: StringToOptionalNonNegativeIntSchema.refine((value) => value === undefined || value > 0, "Not a positive integer"),
  offset: StringToOptionalNonNegativeIntSchema,
  authHeader: AuthHeader.optional(),
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
 * rename to function definition
 */
export interface JobDefinition<T extends ZodType = ZodType> {
  dataSchema?: T;
  /**
   * This is a user provided ID that is used to "identify" the the job code.
   * If the same function is be deployed on multiple workers then they should have the same id,
   * so that any of the workers can pick up the job corresponding to the id when it is scheduled.
   */
  id: string;
  title: string;
  description?: string;
  job: (data: z.infer<T>) => Promise<void> | void;
  example?: z.infer<T>;
  version: number;
  access?: FunctionAccess;
  defaultScheduleAccess?: ScheduleAccess;
  defaultRunAccess?: RunAccess;
}
export const JobDefinitionSchema = z.object({
  dataSchema: z.any().optional(),
  id: z.string(),
  title: z.string(),
  description: z.string().optional(),
  job: z.any(),
  example: z.any().optional(),
  version: z.number().int().positive(),
  access: nullishToUndefined(FunctionAccessSchema),
  defaultScheduleAccess: nullishToUndefined(ScheduleAccessSchema),
  defaultRunAccess: nullishToUndefined(RunAccessSchema),
});
typeAssert<keyof JobDefinition, keyof z.output<typeof JobDefinitionSchema>>();
typeAssert<keyof z.output<typeof JobDefinitionSchema>, keyof JobDefinition>();

//#region API types
export const ScheduleSchema = z.object({
  functionId: z.string(),
  functionVersion: z.number().int().positive(),
  data: z.unknown(),
  options: ScheduleJobOptionsSchema,
});
export const SchedulesFilterSchema = z.object({
  functionId: z.string().optional(),
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

export const UserAuthSchema = z.object({
  admin: z.boolean(),
  system: z.boolean().default(false),
  groups: z.array(GroupKeySchema),
  userId: z.number().optional(),
});

export const GroupSchema = z.object({
  id: z.number().int().positive(),
  key: GroupKeySchema,
  title: z.string().min(1).max(255),
  description: z.string().optional(),
  memberIds: z.array(z.number().int().positive()),
  createdAt: DateSchema,
});
export type Group = z.output<typeof GroupSchema>;

export const CreateGroupSchema = z.object({
  key: GroupKeySchema,
  title: z.string().min(1).max(255),
  description: z.string().max(2000).optional(),
  memberIds: z.array(z.number().int().positive()).default([]),
});
export const UpdateGroupSchema = CreateGroupSchema.omit({ key: true }).partial().extend({
  memberIds: z.array(z.number().int().positive()).optional(),
});

export const AccessDiagnosticSchema = z.object({
  key: z.string(),
  references: z.array(z.string()),
});
export type AccessDiagnostic = z.output<typeof AccessDiagnosticSchema>;
