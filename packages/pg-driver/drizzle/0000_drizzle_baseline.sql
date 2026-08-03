CREATE TABLE "EnscheduleMeta" (
  "id" serial PRIMARY KEY,
  "driverVersion" integer NOT NULL,
  "enscheduleVersion" varchar(255) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE "Workers" (
  "id" serial PRIMARY KEY,
  "workerId" varchar(255) NOT NULL,
  "version" integer NOT NULL,
  "pollInterval" integer NOT NULL,
  "title" varchar(255) NOT NULL,
  "description" text,
  "definitions" jsonb NOT NULL,
  "access" jsonb,
  "defaultFunctionAccess" jsonb,
  "defaultScheduleAccess" jsonb,
  "defaultRunAccess" jsonb,
  "instanceId" varchar(255) NOT NULL,
  "hostname" varchar(255) NOT NULL,
  "lastReached" timestamptz NOT NULL,
  "lastRunId" integer,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "workers_instance_id_unique" ON "Workers" ("instanceId");
CREATE INDEX "workers_worker_id_idx" ON "Workers" ("workerId");

CREATE TABLE "Schedules" (
  "id" serial PRIMARY KEY,
  "workerId" varchar(255),
  "functionId" varchar(255) NOT NULL,
  "functionVersion" integer NOT NULL,
  "data" text,
  "signature" text NOT NULL,
  "claimId" varchar(255),
  "eventId" varchar(255),
  "retries" integer NOT NULL DEFAULT -1,
  "maxRetries" integer NOT NULL DEFAULT -1,
  "retryFailedJobs" boolean NOT NULL DEFAULT false,
  "title" varchar(255) NOT NULL,
  "description" text,
  "claimed" boolean NOT NULL DEFAULT false,
  "runAt" timestamptz,
  "runNow" boolean NOT NULL DEFAULT false,
  "cronExpression" varchar(255),
  "numRuns" integer NOT NULL DEFAULT 0,
  "lastRunId" integer,
  "failureTriggerId" integer,
  "defaultRunAccess" jsonb,
  "access" jsonb,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "schedules_eventid_unique" ON "Schedules" ("eventId");
CREATE INDEX "schedules_due_idx" ON "Schedules" ("claimed", "runAt");
CREATE INDEX "schedules_function_idx" ON "Schedules" ("functionId", "functionVersion");

CREATE TABLE "Runs" (
  "id" serial PRIMARY KEY,
  "logFile" text,
  "logFileSize" integer,
  "logFileRowCount" integer,
  "data" text,
  "exitSignal" text,
  "finishedAt" timestamptz,
  "startedAt" timestamptz NOT NULL,
  "scheduledToRunAt" timestamptz NOT NULL,
  "functionId" varchar(255) NOT NULL,
  "functionVersion" integer NOT NULL,
  "scheduleTitle" varchar(255) NOT NULL,
  "workerTitle" varchar(255) NOT NULL,
  "scheduleId" integer,
  "workerId" integer,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX "runs_schedule_idx" ON "Runs" ("scheduleId");
CREATE INDEX "runs_started_idx" ON "Runs" ("startedAt");

CREATE TABLE "Users" (
  "id" serial PRIMARY KEY,
  "username" varchar(255) NOT NULL UNIQUE,
  "name" varchar(255) NOT NULL,
  "email" varchar(255),
  "password" text NOT NULL,
  "admin" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "Groups" (
  "id" serial PRIMARY KEY,
  "groupName" varchar(64) NOT NULL UNIQUE,
  "title" varchar(255) NOT NULL,
  "description" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "Sessions" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "refreshToken" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE "ApiKeys" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "key" text NOT NULL,
  "expiresAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX "api_keys_key_unique" ON "ApiKeys" ("key");

CREATE TABLE "UserGroupAssociation" (
  "UserId" integer NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "GroupId" integer NOT NULL REFERENCES "Groups"("id") ON DELETE CASCADE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("UserId", "GroupId")
);

CREATE TABLE "RunGroupViewAccess" (
  "RunId" integer NOT NULL REFERENCES "Runs"("id") ON DELETE CASCADE,
  "GroupKey" varchar(64) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("RunId", "GroupKey")
);
CREATE TABLE "RunGroupViewLogsAccess" (
  "RunId" integer NOT NULL REFERENCES "Runs"("id") ON DELETE CASCADE,
  "GroupKey" varchar(64) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("RunId", "GroupKey")
);
CREATE TABLE "RunGroupDeleteAccess" (
  "RunId" integer NOT NULL REFERENCES "Runs"("id") ON DELETE CASCADE,
  "GroupKey" varchar(64) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("RunId", "GroupKey")
);

DO $$ BEGIN
  ALTER TABLE "Runs" ADD CONSTRAINT "fk_run_schedule" FOREIGN KEY ("scheduleId") REFERENCES "Schedules"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Runs" ADD CONSTRAINT "fk_run_worker" FOREIGN KEY ("workerId") REFERENCES "Workers"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Schedules" ADD CONSTRAINT "fk_schedule_lastrun" FOREIGN KEY ("lastRunId") REFERENCES "Runs"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Workers" ADD CONSTRAINT "fk_worker_lastrun" FOREIGN KEY ("lastRunId") REFERENCES "Runs"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
DO $$ BEGIN
  ALTER TABLE "Schedules" ADD CONSTRAINT "fk_schedule_failuretrigger" FOREIGN KEY ("failureTriggerId") REFERENCES "Schedules"("id") ON DELETE SET NULL;
EXCEPTION WHEN duplicate_object THEN NULL; END $$;
