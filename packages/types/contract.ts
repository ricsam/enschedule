import { defineContract, Status } from "@richie-rpc/core";
import { z } from "zod";
import {
  AuthHeader,
  ListRunsOptionsSerializedSchema,
  PublicWorkerSchema,
  ScheduleJobResultSchema,
  ScheduleSchema,
  ScheduleUpdatePayloadSchema,
  SchedulesFilterSchema,
  UserAuthSchema,
  UserSchema,
  publicJobDefinitionSchema,
  publicJobRunSchema,
  publicJobScheduleSchema,
} from "./types";

export const API_BASE_PATH = "/api";

export const ApiErrorSchema = z.object({
  code: z.string(),
  message: z.string(),
  issues: z.array(z.string()).optional(),
});

export const HealthSchema = z.object({
  message: z.literal("Endpoint is healthy"),
  runtime: z.literal("bun"),
});

export const SuccessSchema = z.object({ success: z.boolean() });
export const IdsSchema = z.object({ ids: z.array(z.number().int().positive()) });
export const AuthHeadersSchema = z.object({
  authorization: AuthHeader.optional(),
  "x-api-key": z.string().optional(),
});

export const TokenPairSchema = z.object({
  accessToken: z.string(),
  refreshToken: z.string(),
});

export const SessionUserSchema = z.object({
  userId: z.number().int().positive(),
  admin: z.boolean(),
});

const errorResponses = {
  [Status.BadRequest]: ApiErrorSchema,
  [Status.Unauthorized]: ApiErrorSchema,
  [Status.Forbidden]: ApiErrorSchema,
  [Status.NotFound]: ApiErrorSchema,
  [Status.Conflict]: ApiErrorSchema,
  [Status.InternalServerError]: ApiErrorSchema,
};

export const enscheduleContract = defineContract({
  health: {
    type: "standard",
    method: "GET",
    path: "/healthz",
    responses: { [Status.OK]: HealthSchema },
  },
  login: {
    type: "standard",
    method: "POST",
    path: "/auth/login",
    body: z.object({ username: z.string().min(1), password: z.string().min(1) }),
    responses: { [Status.OK]: TokenPairSchema },
    errorResponses,
  },
  refresh: {
    type: "standard",
    method: "POST",
    path: "/auth/refresh",
    body: z.object({ refreshToken: z.string() }),
    responses: { [Status.OK]: TokenPairSchema },
    errorResponses,
  },
  logout: {
    type: "standard",
    method: "POST",
    path: "/auth/logout",
    body: z.object({ refreshToken: z.string(), allDevices: z.boolean() }),
    responses: { [Status.OK]: SuccessSchema },
    errorResponses,
  },
  session: {
    type: "standard",
    method: "GET",
    path: "/session",
    headers: AuthHeadersSchema,
    responses: {
      [Status.OK]: z.object({
        user: SessionUserSchema.optional(),
        noAuth: z.boolean().optional(),
      }),
    },
    errorResponses,
  },
  userAuth: {
    type: "standard",
    method: "GET",
    path: "/auth",
    headers: AuthHeadersSchema,
    responses: { [Status.OK]: UserAuthSchema },
    errorResponses,
  },
  listUsers: {
    type: "standard",
    method: "GET",
    path: "/users",
    headers: AuthHeadersSchema,
    responses: { [Status.OK]: z.array(UserSchema) },
    errorResponses,
  },
  getUser: {
    type: "standard",
    method: "GET",
    path: "/users/:id",
    params: z.object({ id: z.coerce.number().int().positive() }),
    headers: AuthHeadersSchema,
    responses: { [Status.OK]: UserSchema },
    errorResponses,
  },
  listWorkers: {
    type: "standard",
    method: "GET",
    path: "/workers",
    headers: AuthHeadersSchema,
    responses: { [Status.OK]: z.array(PublicWorkerSchema) },
    errorResponses,
  },
  deleteWorkers: {
    type: "standard",
    method: "DELETE",
    path: "/workers",
    headers: AuthHeadersSchema,
    body: IdsSchema,
    responses: { [Status.OK]: z.array(z.number()) },
    errorResponses,
  },
  listDefinitions: {
    type: "standard",
    method: "GET",
    path: "/definitions",
    headers: AuthHeadersSchema,
    responses: { [Status.OK]: z.array(publicJobDefinitionSchema) },
    errorResponses,
  },
  getDefinition: {
    type: "standard",
    method: "GET",
    path: "/definitions/:id",
    params: z.object({ id: z.string().min(1) }),
    headers: AuthHeadersSchema,
    responses: { [Status.OK]: publicJobDefinitionSchema },
    errorResponses,
  },
  listSchedules: {
    type: "standard",
    method: "GET",
    path: "/schedules",
    headers: AuthHeadersSchema,
    query: SchedulesFilterSchema,
    responses: { [Status.OK]: z.array(publicJobScheduleSchema) },
    errorResponses,
  },
  createSchedule: {
    type: "standard",
    method: "POST",
    path: "/schedules",
    headers: AuthHeadersSchema,
    body: ScheduleSchema,
    responses: { [Status.Created]: ScheduleJobResultSchema },
    errorResponses,
  },
  getSchedule: {
    type: "standard",
    method: "GET",
    path: "/schedules/:id",
    params: z.object({ id: z.coerce.number().int().positive() }),
    headers: AuthHeadersSchema,
    responses: { [Status.OK]: publicJobScheduleSchema },
    errorResponses,
  },
  updateSchedule: {
    type: "standard",
    method: "PATCH",
    path: "/schedules/:id",
    params: z.object({ id: z.coerce.number().int().positive() }),
    headers: AuthHeadersSchema,
    body: ScheduleUpdatePayloadSchema.omit({ id: true }),
    responses: { [Status.OK]: publicJobScheduleSchema },
    errorResponses,
  },
  deleteSchedule: {
    type: "standard",
    method: "DELETE",
    path: "/schedules/:id",
    params: z.object({ id: z.coerce.number().int().positive() }),
    headers: AuthHeadersSchema,
    responses: { [Status.OK]: publicJobScheduleSchema },
    errorResponses,
  },
  scheduleActions: {
    type: "standard",
    method: "POST",
    path: "/schedules/actions",
    headers: AuthHeadersSchema,
    body: IdsSchema.extend({
      action: z.enum(["run", "unschedule", "delete"]),
    }),
    responses: { [Status.OK]: SuccessSchema },
    errorResponses,
  },
  runSchedule: {
    type: "standard",
    method: "POST",
    path: "/schedules/:id/run",
    params: z.object({ id: z.coerce.number().int().positive() }),
    headers: AuthHeadersSchema,
    responses: { [Status.OK]: SuccessSchema },
    errorResponses,
  },
  listRuns: {
    type: "standard",
    method: "GET",
    path: "/runs",
    headers: AuthHeadersSchema,
    query: ListRunsOptionsSerializedSchema.omit({ authHeader: true }),
    responses: {
      [Status.OK]: z.object({ count: z.number(), rows: z.array(publicJobRunSchema) }),
    },
    errorResponses,
  },
  getRun: {
    type: "standard",
    method: "GET",
    path: "/runs/:id",
    params: z.object({ id: z.coerce.number().int().positive() }),
    headers: AuthHeadersSchema,
    responses: { [Status.OK]: publicJobRunSchema },
    errorResponses,
  },
  deleteRun: {
    type: "standard",
    method: "DELETE",
    path: "/runs/:id",
    params: z.object({ id: z.coerce.number().int().positive() }),
    headers: AuthHeadersSchema,
    responses: { [Status.OK]: publicJobRunSchema },
    errorResponses,
  },
  deleteRuns: {
    type: "standard",
    method: "DELETE",
    path: "/runs",
    headers: AuthHeadersSchema,
    body: IdsSchema,
    responses: { [Status.OK]: z.array(z.number()) },
    errorResponses,
  },
  streamLogs: {
    type: "streaming",
    method: "POST",
    path: "/runs/:id/logs",
    params: z.object({ id: z.coerce.number().int().positive() }),
    headers: AuthHeadersSchema,
    chunk: z.object({ text: z.string() }),
    finalResponse: z.object({ complete: z.boolean() }),
    errorResponses,
  },
  reset: {
    type: "standard",
    method: "POST",
    path: "/admin/reset",
    headers: AuthHeadersSchema,
    responses: { [Status.OK]: SuccessSchema },
    errorResponses,
  },
});

export type EnscheduleContract = typeof enscheduleContract;
