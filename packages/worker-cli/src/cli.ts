#!/usr/bin/env node
import fs from "node:fs";
import type http from "node:http";
import os from "node:os";
import path from "node:path";
import crypto from "node:crypto";
import { debug } from "debug";
import { Command, Option } from "commander";
import { Worker } from "@enschedule/worker";
import { z } from "zod";

const log = debug("worker-cli");

function createSecretKey(envKey: string) {
  const tokenDir = path.join(os.homedir(), ".enschedule");
  const tokenFile = path.join(tokenDir, "tokens.json");
  fs.mkdirSync(tokenDir, { recursive: true });
  if (!fs.existsSync(tokenFile)) {
    fs.writeFileSync(tokenFile, JSON.stringify({}));
  }
  const tokens: Record<string, string> = z
    .record(z.string())
    .parse(JSON.parse(fs.readFileSync(tokenFile, "utf-8")));
  if (!tokens[envKey]) {
    tokens[envKey] = crypto.randomBytes(64).toString("hex");
    fs.writeFileSync(tokenFile, JSON.stringify(tokens));
  }
  return tokens[envKey];
}

const parseBoolEnv = (_val: string) => {
  const val = _val.toLowerCase();
  if (val === "true") {
    return true;
  } else if (val === "false") {
    return false;
  } else if (val === "no") {
    return false;
  } else if (val === "yes") {
    return true;
  } else if (val === "0") {
    return false;
  } else if (val === "1") {
    return true;
  } else if (val === "") {
    return true;
  }
  return Boolean(val);
};
const boolParser = (short: string, long: string, env: string) => () => {
  if (
    program.args.includes(`-${short}`) ||
    program.args.includes(`--${long}`)
  ) {
    return true;
  }
  if (typeof process.env[env] === "string") {
    return parseBoolEnv(process.env[env]);
  }
  return false;
};

const program = new Command();

program
  .name("enschedule-worker")
  .description("CLI for the enschedule worker")
  .version("1.0.0");

//-----------------------------------------------------
// 1) enschedule-worker start
//-----------------------------------------------------
const startCmd = new Command("start")
  .description("Start the enschedule worker")
  .addOption(
    new Option("-w, --worker-id <id>", "The id of the worker").env(
      "ENSCHEDULE_WORKER_ID"
    )
  )
  .addOption(
    new Option("-n, --name <name>", "The name of the worker").env(
      "ENSCHEDULE_WORKER_NAME"
    )
  )
  .addOption(
    new Option("-d, --desc <description>", "The description of the worker").env(
      "ENSCHEDULE_WORKER_DESCRIPTION"
    )
  )
  .addOption(
    new Option("-i, --poll-interval [number]", "The poll interval in seconds")
      .env("ENSCHEDULE_POLL_INTERVAL")
      .default(10)
  )
  .addOption(
    new Option(
      "-f, --functions [path...]",
      "A path to a nodejs file exporting a function"
    ).env("ENSCHEDULE_FUNCTIONS")
  )
  .addOption(
    new Option("-r, --rest-api", "Flag to disable or enable the REST API")
      .env("ENSCHEDULE_API")
      .default(false)
      .argParser(boolParser("r", "rest-api", "ENSCHEDULE_API"))
  )
  .addOption(
    new Option("-h, --hostname [hostname]", "The hostname to listen on")
      .env("ENSCHEDULE_API_HOSTNAME")
      .default("localhost")
  )
  .addOption(
    new Option("-p, --port <number>", "port number")
      .env("ENSCHEDULE_API_PORT")
      .default(3000)
  )
  .option(
    "-l, --log-jobs",
    "Flag to enable or disable jobs being logged to stdout",
    false
  )
  .addOption(
    new Option(
      "-a, --access-token-secret [secret]",
      "The secret used to sign access tokens"
    ).env("ENSCHEDULE_ACCESS_TOKEN_SECRET")
  )
  .addOption(
    new Option(
      "-t, --refresh-token-secret [secret]",
      "The secret used to sign refresh tokens"
    ).env("ENSCHEDULE_REFRESH_TOKEN_SECRET")
  )
  .addOption(
    new Option("-k, --api-key [key]", "The API key").env("ENSCHEDULE_API_KEY")
  )
  .addOption(new Option("-u, --nafs-uri [uri]", "The NAFS URI").env("NAFS_URI"))
  .addOption(
    new Option("-m, --migrate", "Flag to enable migration")
      .env("ENSCHEDULE_MIGRATE")
      .default(false)
      .argParser(boolParser("m", "migrate", "ENSCHEDULE_MIGRATE"))
  )
  .addOption(
    new Option("-q, --disable-polling", "Flag to disable polling")
      .env("ENSCHEDULE_DISABLE_POLLING")
      .default(false)
      .argParser(
        boolParser("q", "disable-polling", "ENSCHEDULE_DISABLE_POLLING")
      )
  )
  .action(async (_options) => {

    log("Starting worker with options", _options);

    const options = z
      .object({
        workerId: z.string({ message: "worker id is required" }),
        name: z.string({ message: "worker name is required" }),
        desc: z.string().optional(),
        pollInterval: z.coerce.number().int().positive(),
        functions: z.array(z.string()).optional(),
        restApi: z.boolean(),
        hostname: z.string().optional(),
        port: z.coerce.number().int().positive(),
        logJobs: z.boolean(),
        accessTokenSecret: z
          .string()
          .default(() => createSecretKey("accessTokenSecret")),
        refreshTokenSecret: z
          .string()
          .default(() => createSecretKey("refreshTokenSecret")),
        apiKey: z.string().optional(),
        nafsUri: z.string(),
        migrate: z.boolean(),
        disablePolling: z.boolean(),
      })
      .parse(_options);
    let server: http.Server | undefined;

    function shutdown() {
      log("\nCleaning up resources...");
      if (server) {
        server.close(() => {
          log("HTTP server closed.");
          process.exit(0);
        });
      } else {
        process.exit(0);
      }
    }

    process.on("SIGINT", shutdown);
    process.on("SIGTERM", shutdown);

    process.on("exit", (code) => {
      log(`Process exiting with code ${code}`);
      log("Memory usage:", process.memoryUsage());
    });

    const worker = new Worker({
      workerId: options.workerId,
      name: options.name,
      description: options.desc,
      accessTokenSecret: options.accessTokenSecret,
      refreshTokenSecret: options.refreshTokenSecret,
      apiKey: options.apiKey,
      nafsUri: options.nafsUri,
    });
    worker.logJobs = z.boolean().parse(options.logJobs);

    worker.pollInterval = options.pollInterval;

    const importFn = async (requirePath: string): Promise<void> => {
      const parts = requirePath.split(/,| +/);
      if (parts.length === 1) {
        try {
          // eslint-disable-next-line @typescript-eslint/no-unsafe-call, @typescript-eslint/no-var-requires
          await require(requirePath)(worker);
        } catch (err) {
          console.error("Error loading function", requirePath, err);
        }
      } else {
        await Promise.all(parts.map(importFn));
      }
    };

    if (options.functions) {
      log("Importing functions", options.functions);
      await Promise.all(options.functions.map(importFn));
    }

    const ranJob = await worker.listenForIncomingRuns();
    if (ranJob) {
      return;
    }

    if (options.migrate) {
      log("Migrating");
      await worker.migrateDatabase();
    }

    if (options.restApi) {
      if (!options.apiKey) {
        throw new Error("API key is required when enabling the REST API");
      }
      log("Starting REST API");
      server = worker
        .serve({
          port: z.coerce
            .number({ message: "port must be an int" })
            .int()
            .parse(options.port),
          hostname: z.string().optional().parse(options.hostname),
          apiKey: options.apiKey,
        })
        .listen();
    }

    if (!options.disablePolling) {
      log("Starting polling");
      await worker.startPolling({ dontMigrate: true });
    }
  });

program.addCommand(startCmd);

//---------------------------------------
// Parse CLI
(async () => {
  await program.parseAsync(process.argv);
})().catch((err) => {
  console.error(err);
  process.exit(1);
});
