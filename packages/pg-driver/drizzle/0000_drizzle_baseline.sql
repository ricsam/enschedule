CREATE TABLE IF NOT EXISTS "EnscheduleMeta" (
  "id" serial PRIMARY KEY,
  "driverVersion" integer NOT NULL,
  "enscheduleVersion" varchar(255) NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);

CREATE TABLE IF NOT EXISTS "Workers" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "workers_instance_id_unique" ON "Workers" ("instanceId");
CREATE INDEX IF NOT EXISTS "workers_worker_id_idx" ON "Workers" ("workerId");

CREATE TABLE IF NOT EXISTS "Schedules" (
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
CREATE UNIQUE INDEX IF NOT EXISTS "schedules_eventid_unique" ON "Schedules" ("eventId");
CREATE INDEX IF NOT EXISTS "schedules_due_idx" ON "Schedules" ("claimed", "runAt");
CREATE INDEX IF NOT EXISTS "schedules_function_idx" ON "Schedules" ("functionId", "functionVersion");

CREATE TABLE IF NOT EXISTS "Runs" (
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
CREATE INDEX IF NOT EXISTS "runs_schedule_idx" ON "Runs" ("scheduleId");
CREATE INDEX IF NOT EXISTS "runs_started_idx" ON "Runs" ("startedAt");

CREATE TABLE IF NOT EXISTS "Users" (
  "id" serial PRIMARY KEY,
  "username" varchar(255) NOT NULL UNIQUE,
  "name" varchar(255) NOT NULL,
  "email" varchar(255),
  "password" text NOT NULL,
  "admin" boolean NOT NULL DEFAULT false,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "Groups" (
  "id" serial PRIMARY KEY,
  "groupName" varchar(255) NOT NULL UNIQUE,
  "title" varchar(255) NOT NULL,
  "description" text,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "Sessions" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "refreshToken" text NOT NULL,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "ApiKeys" (
  "id" serial PRIMARY KEY,
  "userId" integer NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "key" text NOT NULL,
  "expiresAt" timestamptz,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now()
);
CREATE UNIQUE INDEX IF NOT EXISTS "api_keys_key_unique" ON "ApiKeys" ("key");

CREATE TABLE IF NOT EXISTS "UserGroupAssociation" (
  "UserId" integer NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE,
  "GroupId" integer NOT NULL REFERENCES "Groups"("id") ON DELETE CASCADE,
  "createdAt" timestamptz NOT NULL DEFAULT now(),
  "updatedAt" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("UserId", "GroupId")
);

DO $$
DECLARE access_table text;
BEGIN
  FOREACH access_table IN ARRAY ARRAY[
    'RunUserViewAccess', 'RunUserViewLogsAccess', 'RunUserDeleteAccess'
  ] LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I ("RunId" integer NOT NULL REFERENCES "Runs"("id") ON DELETE CASCADE, "UserId" integer NOT NULL REFERENCES "Users"("id") ON DELETE CASCADE, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("RunId", "UserId"))', access_table);
  END LOOP;
  FOREACH access_table IN ARRAY ARRAY[
    'RunGroupViewAccess', 'RunGroupViewLogsAccess', 'RunGroupDeleteAccess'
  ] LOOP
    EXECUTE format('CREATE TABLE IF NOT EXISTS %I ("RunId" integer NOT NULL REFERENCES "Runs"("id") ON DELETE CASCADE, "GroupId" integer NOT NULL REFERENCES "Groups"("id") ON DELETE CASCADE, "createdAt" timestamptz NOT NULL DEFAULT now(), "updatedAt" timestamptz NOT NULL DEFAULT now(), PRIMARY KEY ("RunId", "GroupId"))', access_table);
  END LOOP;
END $$;

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
