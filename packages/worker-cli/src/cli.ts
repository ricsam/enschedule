#!/usr/bin/env node
import { Command, Option } from "commander";
import fs from "fs";

import { Worker } from "@enschedule/worker";
import { debug } from "debug";
import path from "path";
import os from "os";
import type http from "node:http";
import { z } from "zod";

const log = debug("worker-cli");

function createSecretKey(envKey: string) {
  const tokenDir = path.join(os.homedir(), ".enschedule");
  const tokenFile = path.join(tokenDir, "tokens.json");
  fs.mkdirSync(tokenDir, { recursive: true });
  if (!fs.existsSync(tokenFile)) {
    fs.writeFileSync(tokenFile, JSON.stringify({}));
  }
  const tokens: Record<string, string> = JSON.parse(
    fs.readFileSync(tokenFile, "utf-8")
  );
  if (!tokens[envKey]) {
    tokens[envKey] = require("crypto").randomBytes(64).toString("hex");
    fs.writeFileSync(tokenFile, JSON.stringify(tokens));
  }
  return tokens[envKey];
}

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
    new Option("-w, --worker-id <id>", "The id of the worker").env("WORKER_ID")
  )
  .addOption(
    new Option("-n, --name <name>", "The name of the worker").env("WORKER_NAME")
  )
  .addOption(
    new Option("-d, --desc <description>", "The description of the worker").env(
      "WORKER_DESCRIPTION"
    )
  )
  .addOption(
    new Option("-i, --poll-interval [number]", "The poll interval in seconds")
      .env("POLL_INTERVAL")
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
  )
  .addOption(
    new Option("-h, --hostname [hostname]", "The hostname to listen on")
      .env("API_HOSTNAME")
      .default("localhost")
  )
  .addOption(
    new Option("-p, --port <number>", "port number")
      .env("API_PORT")
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
    ).env("ACCESS_TOKEN_SECRET")
  )
  .addOption(
    new Option(
      "-t, --refresh-token-secret [secret]",
      "The secret used to sign refresh tokens"
    ).env("REFRESH_TOKEN_SECRET")
  )
  .addOption(new Option("-k, --api-key [key]", "The API key").env("API_KEY"))
  .addOption(new Option("-u, --nafs-uri [uri]", "The NAFS URI").env("NAFS_URI"))
  .action(async (options) => {
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
      workerId: z
        .string({ message: "worker id is required" })
        .parse(options.workerId),
      name: z
        .string({ message: "worker name is required" })
        .parse(options.name),
      description: z.string().optional().parse(options.desc),
      accessTokenSecret:
        options.accessTokenSecret ?? createSecretKey("accessTokenSecret"),
      refreshTokenSecret:
        options.refreshTokenSecret ?? createSecretKey("refreshTokenSecret"),
      apiKey: options.apiKey,
      nafsUri: options.nafsUri,
    });
    worker.logJobs = z.boolean().parse(options.logJobs);
    const pollInterval = z.coerce
      .number()
      .int()
      .positive()
      .safeParse(Number(options.pollInterval));

    worker.pollInterval = pollInterval.success ? pollInterval.data : 10;

    void (async () => {
      const importFn = async (requirePath: string): Promise<void> => {
        const parts = requirePath.split(/,| +/);
        if (parts.length === 1) {
          try {
            await require(requirePath)(worker);
          } catch (err) {
            console.error("Error loading function", requirePath, err);
          }
        } else {
          await Promise.all(parts.map(importFn));
        }
      };

      if (options.functions) {
        await Promise.all(options.functions.map(importFn));
      }

      const ranJob = await worker.listenForIncomingRuns();
      if (ranJob) {
        return;
      }

      await worker.migrateDatabase();

      if (options.restApi) {
        if (!options.apiKey) {
          throw new Error("API key is required when enabling the REST API");
        }
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

      await worker.startPolling({ dontMigrate: true });
    })();
  });

program.addCommand(startCmd);

//---------------------------------------
// Parse CLI
program.parseAsync(process.argv);
