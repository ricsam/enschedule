import fs from "node:fs";
import { ScheduleJobOptionsSchema, ScheduleSchema } from "@enschedule/types";
import { NetworkError } from "@enschedule/worker-api";
import { Command } from "commander";
import { glob } from "glob";
import yaml from "js-yaml";
import { z } from "zod";
import { ConfigError, getAuthHeader, getWorker } from "../get-worker";
import { log } from "../log";

const isDirectory = async (p: string): Promise<boolean> => {
  const stat = await fs.promises.stat(p);
  return stat.isDirectory();
};

export const applyCommand = new Command("apply");

export const ScheduleYamlSchema = z.object({
  apiVersion: z.literal("v1"),
  kind: z.literal("schedule"),
  metadata: z.object({
    name: z.string(),
  }),
  spec: z.intersection(
    ScheduleSchema.omit({ options: true }),
    z.object({
      options: ScheduleJobOptionsSchema.omit({ eventId: true }),
    })
  ),
});

export const apply = async (
  config: z.infer<typeof ScheduleYamlSchema>
): Promise<void> => {
  try {
    const authHeader = await getAuthHeader();
    const worker = await getWorker();
    try {
      const { status } = await worker.scheduleJob(
        authHeader,
        config.spec.functionId,
        config.spec.functionVersion,
        config.spec.data,
        { ...config.spec.options, eventId: config.metadata.name }
      );
      console.log("Schedule", config.metadata.name, status);
    } catch (err) {
      if (err instanceof NetworkError) {
        console.error("Network error:", err.cliMessage);
        process.exit(1);
      } else {
        throw err;
      }
    }
  } catch (err) {
    if (err instanceof ConfigError) {
      console.error(
        "You have an error in your config. Please check your ~/.enschedule/config.json file or the ENSCHEDULE_API_KEY, ENSCHEDULE_API_ENDPOINT, and ENSCHEDULE_API_VERSION environment variables."
      );
      process.exit(1);
    }
    log("There was an unknown error", err);
  }
};

applyCommand
  .description("Apply a schedule from a file or folder")
  .requiredOption("-f, --file <type>", "file or folder to apply")

  .action(async (options: { file: string }) => {
    const resolvedPaths = (
      await Promise.all(
        (
          await glob(options.file, { cwd: process.cwd(), absolute: true })
        ).map(async (fileOrFolder) => {
          if (await isDirectory(fileOrFolder)) {
            return glob(`${fileOrFolder}/*.{yaml,yml,json}`, {
              absolute: true,
            });
          }
          return fileOrFolder;
        })
      )
    )
      .flatMap((fpath) => {
        if (Array.isArray(fpath)) {
          return fpath;
        }
        return [fpath];
      })
      .filter((fpath) => {
        return (
          fpath.endsWith(".yaml") ||
          fpath.endsWith(".yml") ||
          fpath.endsWith(".json")
        );
      });

    let hasApplied = false;
    for (const absolutePath of resolvedPaths) {
      const fileContent = fs.readFileSync(absolutePath, "utf8");
      let data;

      if (absolutePath.endsWith(".yaml") || absolutePath.endsWith(".yml")) {
        data = yaml.loadAll(fileContent);
      } else if (absolutePath.endsWith(".json")) {
        // eslint-disable-next-line @typescript-eslint/no-unsafe-assignment
        data = JSON.parse(fileContent);
      } else {
        throw new Error("Unsupported file format");
      }

      if (Array.isArray(data)) {
        const configs = data.map((config) => ScheduleYamlSchema.parse(config));
        for (const config of configs) {
          // eslint-disable-next-line no-await-in-loop
          await apply(config);
          hasApplied = true;
        }
      } else {
        // eslint-disable-next-line no-await-in-loop
        await apply(ScheduleYamlSchema.parse(data));
        hasApplied = true;
      }
    }
    if (!hasApplied) {
      console.error("No schedules found in the provided file or folder");
      process.exit(1);
    }
  });
