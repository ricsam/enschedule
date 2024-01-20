import fs from "node:fs";
import os from "node:os";
import { WorkerAPI } from "@enschedule/worker-api";
import { z } from "zod";

// If the config file doesn't exist, create it with default values
const defaultConfig = {
  apiKey: "your-api-key",
  apiEndpoint: "http://localhost:8080",
  apiVersion: "1",
};

const ConfigValSchema = (key: keyof typeof defaultConfig) =>
  z
    .string()
    .optional()
    .transform((value) => (!value ? defaultConfig[key] : value));

// Define the Zod schema for the config
const configSchema = z.object({
  apiEndpoint: ConfigValSchema("apiEndpoint"),
  apiKey: ConfigValSchema("apiKey"),
  apiVersion: ConfigValSchema("apiVersion"),
});

const getConfig = async () => {
  const configPath = `${os.homedir()}/.enschedule/config.json`;

  try {
    // Read the config file
    const configData = await fs.promises.readFile(configPath, "utf8");
    const config = configSchema.parse(JSON.parse(configData));

    // Retrieve the apiKey, apiEndpoint, and apiVersion
    const { apiKey, apiEndpoint, apiVersion } = config;

    return { apiKey, apiEndpoint, apiVersion };
  } catch (error) {
    await fs.promises.mkdir(`${os.homedir()}/.enschedule`, {
      recursive: true,
    });
    await fs.promises.writeFile(
      configPath,
      JSON.stringify(defaultConfig, null, 2)
    );

    return defaultConfig;
  }
};
let _worker: WorkerAPI | undefined;
export const getWorker = async () => {
  if (_worker) {
    return _worker;
  }
  const options = await getConfig();
  _worker = new WorkerAPI(options.apiKey, options.apiEndpoint);
  return _worker;
};
