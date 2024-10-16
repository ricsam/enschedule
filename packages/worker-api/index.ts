/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @typescript-eslint/no-loop-func */
/* eslint-disable no-await-in-loop */
import http from "node:http";
import https from "node:https";
import type {
  ListRunsOptions,
  PublicJobDefinition,
  PublicJobRun,
  PublicJobSchedule,
  PublicWorker,
  ScheduleJobOptions,
  ScheduleJobResult,
  ScheduleUpdatePayloadSchema,
  SchedulesFilterSchema,
} from "@enschedule/types";
import {
  ListRunsOptionsSerialize,
  PublicWorkerSchema,
  ScheduleJobResultSchema,
  UserSchema,
  publicJobDefinitionSchema,
  publicJobRunSchema,
  publicJobScheduleSchema,
} from "@enschedule/types";
import { debug } from "debug";
import { z } from "zod";

const log = debug("worker-api");
if (process.env.DEBUG) {
  debug.enable(process.env.DEBUG);
}

export class WorkerAPI {
  private hostname: string;
  private apiKey: string;
  private ssl: boolean;
  private port: number;
  private url: string;

  /**
   * @param apiKey - The API_KEY environment variable provided to the worker
   * @param url - The URL of the worker e.g. https://localhost or http://my-worker.localdomain.localhost:8080
   */
  constructor(apiKey: string, url: string) {
    this.url = url;
    const urlObject = new URL(url);
    this.apiKey = apiKey;
    this.hostname = urlObject.hostname;
    this.ssl = urlObject.protocol === "https:";
    if (urlObject.port) {
      this.port = parseInt(urlObject.port);
    } else {
      this.port = this.ssl ? 443 : 80;
    }
  }

  private async request(
    method: "POST" | "PUT",
    path: string,
    data?: unknown
  ): Promise<unknown>;
  private async request(
    method: "GET" | "DELETE",
    path: string,
    data?: Record<string, string | number | boolean | undefined>
  ): Promise<unknown>;
  private async request(
    method: "POST" | "DELETE" | "GET" | "PUT",
    path: string,
    data?: Record<string, string | number | boolean | undefined>
  ) {
    let dataString = "";
    if (data && method === "GET") {
      dataString = Object.entries(data)
        .filter(
          (a): a is [string, string | number | boolean] => a[1] !== undefined
        )
        .map(([key, value]) => `${key}=${encodeURIComponent(value)}`)
        .join("&");
    }
    const bodyString = JSON.stringify(data);
    const options = {
      hostname: this.hostname,
      port: this.port,
      path: `/api/v1${
        method === "GET" && dataString ? `${path}?${dataString}` : path
      }`,
      method,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": this.apiKey,
      },
    };
    const retries = 5;
    const delay = 1000;
    const requestLog = (...args: unknown[]) => {
      log("Req:", method, `${this.url}${decodeURI(options.path)}`, ...args);
    };

    if (data) {
      requestLog("data:", JSON.stringify(data));
    }

    let attempt = 0;

    while (attempt < retries) {
      try {
        const response = await new Promise((resolve, reject) => {
          const req = (this.ssl ? https : http).request(options, (res) => {
            let body = "";
            res.on("data", (chunk) => {
              body += chunk;
            });
            res.on("end", () => {
              const responseLog = (...args: unknown[]) => {
                log(
                  "Res:",
                  method,
                  `${this.url}${options.path}`,
                  res.statusCode,
                  res.statusMessage,
                  ...args
                );
              };
              responseLog();

              try {
                const resData: unknown = JSON.parse(body);
                resolve(resData);
                if (resData) {
                  responseLog("data:", JSON.stringify(resData));
                }
              } catch (err) {
                responseLog(
                  "Failed to json parse, the response body was:",
                  body
                );
                reject(err);
              }
            });
          });

          req.on("error", reject);
          if (data && (method === "POST" || method === "PUT")) {
            req.write(bodyString);
          }
          req.end();
        });
        return response;
      } catch (error) {
        attempt += 1;
        requestLog(`Attempt ${attempt} failed:`, String(error));

        // If we've used all retries, throw the error
        if (attempt >= retries) {
          throw new Error(
            `Req: ${method} ${this.url}${decodeURI(
              options.path
            )} failed after ${attempt} attempts: ${String(error)}`
          );
        }

        // Wait for an exponential backoff time before retrying
        await new Promise<void>((resolve) => {
          setTimeout(resolve, delay * Math.pow(2, attempt - 1));
        });
      }
    }
  }

  async getLatestHandlers(): Promise<PublicJobDefinition[]> {
    const jobDefinitions = await this.request("GET", "/job-definitions");
    return z.array(publicJobDefinitionSchema).parse(jobDefinitions);
  }

  async unschedule(ids: number[]): Promise<void> {
    await this.request("POST", "/unschedule", ids);
  }

  async getLatestHandler(id: string): Promise<PublicJobDefinition> {
    const definition = await this.request("GET", `/job-definitions/${id}`);
    return publicJobDefinitionSchema.parse(definition);
  }

  async getSchedules(
    filter: z.output<typeof SchedulesFilterSchema> = {}
  ): Promise<PublicJobSchedule[]> {
    const schedules = await this.request("GET", "/schedules", filter);
    return z.array(publicJobScheduleSchema).parse(schedules);
  }

  async deleteWorkers(ids: number[]): Promise<number[]> {
    const workers = await this.request("POST", "/workers", { ids });
    return z.array(z.number()).parse(workers);
  }

  async getWorkers(): Promise<PublicWorker[]> {
    const workers = await this.request("GET", "/workers");
    return z.array(PublicWorkerSchema).parse(workers);
  }

  async scheduleJob(
    handlerId: string,
    handlerVersion: number,
    data: unknown,
    options: ScheduleJobOptions
  ): Promise<ScheduleJobResult> {
    const result = await this.request("POST", "/schedules", {
      handlerId,
      handlerVersion,
      data,
      options,
    });
    return ScheduleJobResultSchema.parse(result);
  }

  async getSchedule(id: number): Promise<PublicJobSchedule> {
    const schedule = await this.request("GET", `/schedules/${id}`);
    return publicJobScheduleSchema.parse(schedule);
  }

  async deleteSchedule(id: number): Promise<PublicJobSchedule> {
    const schedule = await this.request("DELETE", `/schedules/${id}`);
    return publicJobScheduleSchema.parse(schedule);
  }

  async deleteSchedules(scheduleIds: number[]): Promise<number[]> {
    const response = await this.request("POST", "/delete-schedules", {
      scheduleIds,
    });
    return z.array(z.number()).parse(response);
  }

  async getRuns(options: ListRunsOptions): Promise<PublicJobRun[]> {
    const runs = await this.request(
      "GET",
      "/runs",
      ListRunsOptionsSerialize(options)
    );
    return z.array(publicJobRunSchema).parse(runs);
  }

  async updateSchedule(
    updatePayload: z.output<typeof ScheduleUpdatePayloadSchema>
  ): Promise<PublicJobSchedule> {
    const schedule = await this.request(
      "PUT",
      `/schedules/${updatePayload.id}`,
      {
        ...updatePayload,
        runAt: updatePayload.runAt
          ? updatePayload.runAt.toJSON()
          : updatePayload.runAt,
      }
    );
    return publicJobScheduleSchema.parse(schedule);
  }

  async getRun(id: number): Promise<PublicJobRun> {
    const run = await this.request("GET", `/runs/${id}`);
    return publicJobRunSchema.parse(run);
  }

  async deleteRun(id: number): Promise<PublicJobRun> {
    const run = await this.request("DELETE", `/runs/${id}`);
    return publicJobRunSchema.parse(run);
  }

  async deleteRuns(runIds: number[]): Promise<number[]> {
    const response = await this.request("POST", "/delete-runs", {
      runIds,
    });
    return z.array(z.number()).parse(response);
  }

  async reset(): Promise<void> {
    await this.request("DELETE", `/`);
  }

  async runScheduleNow(id: number): Promise<void> {
    await this.request("POST", `/schedules/${id}/runs`);
  }

  async runSchedulesNow(ids: number[]): Promise<void> {
    await this.request("POST", `/runs-schedules`, ids);
  }

  async login(
    username: string,
    password: string
  ): Promise<undefined | { refreshToken: string; accessToken: string }> {
    try {
      const tokens = await this.request("POST", "/login", {
        username,
        password,
      });
      const result = z
        .object({
          refreshToken: z.string(),
          accessToken: z.string(),
        })
        .safeParse(tokens);

      if (result.success) {
        return result.data;
      }
    } catch (err) {
      // some error that can be ignored
    }
  }

  async refreshToken(
    refreshToken: string
  ): Promise<undefined | { refreshToken: string; accessToken: string }> {
    try {
      const tokens = await this.request("POST", "/refresh-token", {
        refreshToken,
      });
      const result = z
        .object({
          refreshToken: z.string(),
          accessToken: z.string(),
        })
        .safeParse(tokens);

      if (result.success) {
        return result.data;
      }
    } catch (err) {
      // some error that can be ignored
    }
  }

  async getUser(
    userId: number
  ): Promise<undefined | z.output<typeof UserSchema>> {
    try {
      const user = await this.request("GET", `/users/${userId}`);
      const result = UserSchema.safeParse(user);

      if (result.success) {
        return result.data;
      }
    } catch (err) {
      // some error that can be ignored
    }
  }

  async logout(refreshToken: string, allDevices: boolean): Promise<void> {
    await this.request("POST", "/logout", { refreshToken, allDevices });
  }
}
