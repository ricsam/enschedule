import { ScheduleSchema } from "@enschedule/types";
import { Command } from "commander";
import { glob } from "glob";
import yaml from "js-yaml";
import fs from "node:fs";
import { z } from "zod";
import { getAuthHeader, getWorker } from "../get-worker";

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
  spec: ScheduleSchema,
});

export const apply = async (
  config: z.infer<typeof ScheduleYamlSchema>
): Promise<void> => {
  const authHeader = await getAuthHeader();
  const worker = await getWorker();
  const { status } = await worker.scheduleJob(
    authHeader,
    config.spec.handlerId,
    config.spec.handlerVersion,
    config.spec.data,
    { ...config.spec.options, eventId: config.metadata.name }
  );
  console.log("Schedule", config.metadata.name, status);
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
        }
      } else {
        // eslint-disable-next-line no-await-in-loop
        await apply(ScheduleYamlSchema.parse(data));
      }
    }
  });
