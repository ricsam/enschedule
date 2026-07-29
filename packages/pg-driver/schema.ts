import { relations } from "drizzle-orm";
import {
  boolean,
  index,
  integer,
  jsonb,
  pgTable,
  primaryKey,
  serial,
  text,
  timestamp,
  uniqueIndex,
  varchar,
} from "drizzle-orm/pg-core";
import type {
  FunctionAccess,
  PublicJobDefinition,
  RunAccess,
  ScheduleAccess,
  WorkerAccess,
} from "@enschedule/types";

const auditColumns = {
  createdAt: timestamp("createdAt", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
  updatedAt: timestamp("updatedAt", { withTimezone: true, mode: "date" })
    .defaultNow()
    .notNull(),
};

export const enscheduleMeta = pgTable("EnscheduleMeta", {
  id: serial("id").primaryKey(),
  driverVersion: integer("driverVersion").notNull(),
  enscheduleVersion: varchar("enscheduleVersion", { length: 255 }).notNull(),
  ...auditColumns,
});

export const workers = pgTable(
  "Workers",
  {
    id: serial("id").primaryKey(),
    workerId: varchar("workerId", { length: 255 }).notNull(),
    version: integer("version").notNull(),
    pollInterval: integer("pollInterval").notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    definitions: jsonb("definitions").$type<PublicJobDefinition[]>().notNull(),
    access: jsonb("access").$type<WorkerAccess>(),
    defaultFunctionAccess: jsonb("defaultFunctionAccess").$type<FunctionAccess>(),
    defaultScheduleAccess: jsonb("defaultScheduleAccess").$type<ScheduleAccess>(),
    defaultRunAccess: jsonb("defaultRunAccess").$type<RunAccess>(),
    instanceId: varchar("instanceId", { length: 255 }).notNull(),
    hostname: varchar("hostname", { length: 255 }).notNull(),
    lastReached: timestamp("lastReached", { withTimezone: true, mode: "date" }).notNull(),
    lastRunId: integer("lastRunId"),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("workers_instance_id_unique").on(table.instanceId),
    index("workers_worker_id_idx").on(table.workerId),
  ],
);

export const schedules = pgTable(
  "Schedules",
  {
    id: serial("id").primaryKey(),
    workerId: varchar("workerId", { length: 255 }),
    functionId: varchar("functionId", { length: 255 }).notNull(),
    functionVersion: integer("functionVersion").notNull(),
    data: text("data"),
    signature: text("signature").notNull(),
    claimId: varchar("claimId", { length: 255 }),
    eventId: varchar("eventId", { length: 255 }),
    retries: integer("retries").default(-1).notNull(),
    maxRetries: integer("maxRetries").default(-1).notNull(),
    retryFailedJobs: boolean("retryFailedJobs").default(false).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    claimed: boolean("claimed").default(false).notNull(),
    runAt: timestamp("runAt", { withTimezone: true, mode: "date" }),
    runNow: boolean("runNow").default(false).notNull(),
    cronExpression: varchar("cronExpression", { length: 255 }),
    numRuns: integer("numRuns").default(0).notNull(),
    lastRunId: integer("lastRunId"),
    failureTriggerId: integer("failureTriggerId"),
    defaultRunAccess: jsonb("defaultRunAccess").$type<RunAccess>(),
    access: jsonb("access").$type<ScheduleAccess>(),
    ...auditColumns,
  },
  (table) => [
    uniqueIndex("schedules_eventid_unique").on(table.eventId),
    index("schedules_due_idx").on(table.claimed, table.runAt),
    index("schedules_function_idx").on(table.functionId, table.functionVersion),
  ],
);

export const runs = pgTable(
  "Runs",
  {
    id: serial("id").primaryKey(),
    logFile: text("logFile"),
    logFileSize: integer("logFileSize"),
    logFileRowCount: integer("logFileRowCount"),
    data: text("data"),
    exitSignal: text("exitSignal"),
    finishedAt: timestamp("finishedAt", { withTimezone: true, mode: "date" }),
    startedAt: timestamp("startedAt", { withTimezone: true, mode: "date" }).notNull(),
    scheduledToRunAt: timestamp("scheduledToRunAt", {
      withTimezone: true,
      mode: "date",
    }).notNull(),
    functionId: varchar("functionId", { length: 255 }).notNull(),
    functionVersion: integer("functionVersion").notNull(),
    scheduleTitle: varchar("scheduleTitle", { length: 255 }).notNull(),
    workerTitle: varchar("workerTitle", { length: 255 }).notNull(),
    scheduleId: integer("scheduleId"),
    workerId: integer("workerId"),
    ...auditColumns,
  },
  (table) => [
    index("runs_schedule_idx").on(table.scheduleId),
    index("runs_started_idx").on(table.startedAt),
  ],
);

export const users = pgTable(
  "Users",
  {
    id: serial("id").primaryKey(),
    username: varchar("username", { length: 255 }).notNull(),
    name: varchar("name", { length: 255 }).notNull(),
    email: varchar("email", { length: 255 }),
    password: text("password").notNull(),
    admin: boolean("admin").default(false).notNull(),
    ...auditColumns,
  },
  (table) => [uniqueIndex("users_username_unique").on(table.username)],
);

export const groups = pgTable(
  "Groups",
  {
    id: serial("id").primaryKey(),
    groupName: varchar("groupName", { length: 255 }).notNull(),
    title: varchar("title", { length: 255 }).notNull(),
    description: text("description"),
    ...auditColumns,
  },
  (table) => [uniqueIndex("groups_group_name_unique").on(table.groupName)],
);

export const sessions = pgTable(
  "Sessions",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    refreshToken: text("refreshToken").notNull(),
    ...auditColumns,
  },
  (table) => [index("sessions_user_idx").on(table.userId)],
);

export const apiKeys = pgTable(
  "ApiKeys",
  {
    id: serial("id").primaryKey(),
    userId: integer("userId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade", onUpdate: "cascade" }),
    key: text("key").notNull(),
    expiresAt: timestamp("expiresAt", { withTimezone: true, mode: "date" }),
    ...auditColumns,
  },
  (table) => [uniqueIndex("api_keys_key_unique").on(table.key)],
);

export const userGroupAssociation = pgTable(
  "UserGroupAssociation",
  {
    userId: integer("UserId")
      .notNull()
      .references(() => users.id, { onDelete: "cascade" }),
    groupId: integer("GroupId")
      .notNull()
      .references(() => groups.id, { onDelete: "cascade" }),
    ...auditColumns,
  },
  (table) => [primaryKey({ columns: [table.userId, table.groupId] })],
);

function runUserAccessTable(name: string) {
  return pgTable(
    name,
    {
      runId: integer("RunId")
        .notNull()
        .references(() => runs.id, { onDelete: "cascade" }),
      userId: integer("UserId")
        .notNull()
        .references(() => users.id, { onDelete: "cascade" }),
      ...auditColumns,
    },
    (table) => [primaryKey({ columns: [table.runId, table.userId] })],
  );
}

function runGroupAccessTable(name: string) {
  return pgTable(
    name,
    {
      runId: integer("RunId")
        .notNull()
        .references(() => runs.id, { onDelete: "cascade" }),
      groupId: integer("GroupId")
        .notNull()
        .references(() => groups.id, { onDelete: "cascade" }),
      ...auditColumns,
    },
    (table) => [primaryKey({ columns: [table.runId, table.groupId] })],
  );
}

export const runUserViewAccess = runUserAccessTable("RunUserViewAccess");
export const runGroupViewAccess = runGroupAccessTable("RunGroupViewAccess");
export const runUserViewLogsAccess = runUserAccessTable("RunUserViewLogsAccess");
export const runGroupViewLogsAccess = runGroupAccessTable("RunGroupViewLogsAccess");
export const runUserDeleteAccess = runUserAccessTable("RunUserDeleteAccess");
export const runGroupDeleteAccess = runGroupAccessTable("RunGroupDeleteAccess");

export const workersRelations = relations(workers, ({ many, one }) => ({
  runs: many(runs),
  lastRun: one(runs, { fields: [workers.lastRunId], references: [runs.id] }),
}));
export const schedulesRelations = relations(schedules, ({ many, one }) => ({
  runs: many(runs),
  lastRun: one(runs, { fields: [schedules.lastRunId], references: [runs.id] }),
  failureTrigger: one(schedules, {
    fields: [schedules.failureTriggerId],
    references: [schedules.id],
    relationName: "failureTrigger",
  }),
}));
export const runsRelations = relations(runs, ({ one }) => ({
  schedule: one(schedules, { fields: [runs.scheduleId], references: [schedules.id] }),
  worker: one(workers, { fields: [runs.workerId], references: [workers.id] }),
}));
export const usersRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  apiKeys: many(apiKeys),
  groups: many(userGroupAssociation),
}));
export const groupsRelations = relations(groups, ({ many }) => ({
  users: many(userGroupAssociation),
}));
export const userGroupRelations = relations(userGroupAssociation, ({ one }) => ({
  user: one(users, { fields: [userGroupAssociation.userId], references: [users.id] }),
  group: one(groups, { fields: [userGroupAssociation.groupId], references: [groups.id] }),
}));
