import fs from "node:fs";
import os from "node:os";
import { WorkerAPI } from "@enschedule/worker-api";
import { z } from "zod";
import { AuthHeader } from "@enschedule/types";

export class ConfigError extends Error {}

const UserFriendlyKey = z.string().transform((val, ctx) => {
  let header = val;
  if (
    val.startsWith("Api-Key") ||
    val.startsWith("User-Api-Key") ||
    val.startsWith("Jwt")
  ) {
    header = val;
  } else {
    header = `Api-Key ${val}`;
  }

  const parsed = AuthHeader.safeParse(header);
  if (!parsed.success) {
    ctx.addIssue({
      code: z.ZodIssueCode.custom,
      message: "Invalid auth header / api key",
    });
    return z.NEVER;
  }
  return parsed.data;
});

// Define the Zod schema for the config
const configSchema = z.object({
  apiEndpoint: z.string(),
  apiKey: UserFriendlyKey,
  apiVersion: z.literal("1"),
});
const configFileSchema = z.object({
  apiEndpoint: z.string().optional(),
  apiKey: UserFriendlyKey.optional(),
  apiVersion: z.literal("1").optional(),
});

export const getConfig = async () => {
  const configPath = `${os.homedir()}/.enschedule/config.json`;
  let configFile: Partial<z.output<typeof configSchema>> = {};
  // Read the config file
  try {
    configFile = configFileSchema.parse(
      JSON.parse(await fs.promises.readFile(configPath, "utf8"))
    );
  } catch (err) {}
  try {
    let config: z.output<typeof configSchema> = configSchema.parse({
      apiKey: process.env.ENSCHEDULE_API_KEY ?? configFile.apiKey,
      apiEndpoint:
        process.env.ENSCHEDULE_API_ENDPOINT ?? configFile.apiEndpoint,
      apiVersion: process.env.ENSCHEDULE_API_VERSION ?? configFile.apiVersion,
    });

    // Retrieve the apiKey, apiEndpoint, and apiVersion
    const { apiKey, apiEndpoint, apiVersion } = config;

    return { apiKey, apiEndpoint, apiVersion };
  } catch (error) {
    // await fs.promises.mkdir(`${os.homedir()}/.enschedule`, {
    //   recursive: true,
    // });
    // await fs.promises.writeFile(
    //   configPath,
    //   JSON.stringify(defaultConfig, null, 2)
    // );
    throw new ConfigError();
  }
};
let _worker: WorkerAPI | undefined;
export const getWorker = async () => {
  if (_worker) {
    return _worker;
  }
  const options = await getConfig();
  _worker = new WorkerAPI(options.apiKey, options.apiEndpoint, {
    retries: 0,
  });
  return _worker;
};

export const getAuthHeader = async () => {
  const options = await getConfig();
  return options.apiKey;
};
