/* eslint-disable eslint-comments/disable-enable-pair */
/* eslint-disable @typescript-eslint/no-loop-func */
/* eslint-disable no-await-in-loop */
import http from "node:http";
import https from "node:https";
import type {
  PublicJobDefinition,
  PublicJobRun,
  PublicJobSchedule,
  ScheduleJobOptions,
} from "@enschedule/types";
import {
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
    method: "POST" | "DELETE",
    path: string,
    data?: unknown
  ): Promise<unknown>;
  private async request(
    method: "GET",
    path: string,
    data?: Record<string, string | number | boolean | undefined>
  ): Promise<unknown>;
  private async request(
    method: "POST" | "DELETE" | "GET",
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
      path: method === "GET" && dataString ? `${path}?${dataString}` : path,
      method,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": this.apiKey,
      },
    };
    const retries = 5;
    const delay = 1000;
    log(
      "Req:",
      method,
      `${this.url}${decodeURI(options.path)}${
        data ? ` ${JSON.stringify(data)}` : ""
      }`
    );

    let attempt = 0;

    while (attempt < retries) {
      try {
        const response = new Promise((resolve, reject) => {
          const req = (this.ssl ? https : http).request(options, (res) => {
            let body = "";
            res.on("data", (chunk) => {
              body += chunk;
            });
            res.on("end", () => {
              log(
                "Res:",
                method,
                `${this.url}${path}`,
                res.statusCode,
                res.statusMessage
              );
              try {
                const resData: unknown = JSON.parse(body);
                resolve(resData);
                if (resData) {
                  log("Res data:", JSON.stringify(resData));
                }
              } catch (err) {
                log("Failed to json parse, the response body was:", body);
                reject(err);
              }
            });
          });

          req.on("error", reject);
          if (data && method !== "GET") {
            req.write(bodyString);
          }
          req.end();
        });
        return response;
      } catch (error) {
        attempt += 1;
        const errorMessage = error instanceof Error ? error.message : "";
        log(`Attempt ${attempt} failed:`, errorMessage);

        // If we've used all retries, throw the error
        if (attempt >= retries) {
          throw new Error(
            `Request failed after ${attempt} attempts: ${errorMessage}`
          );
        }

        // Wait for an exponential backoff time before retrying
        await new Promise<void>((resolve) => {
          setTimeout(resolve, delay * Math.pow(2, attempt - 1));
        });
      }
    }
  }

  async getJobDefinitions(): Promise<PublicJobDefinition[]> {
    const jobDefinitions = await this.request("GET", "/job-definitions");
    return z.array(publicJobDefinitionSchema).parse(jobDefinitions);
  }

  async getJobDefinition(id: string): Promise<PublicJobDefinition> {
    const definition = await this.request("GET", `/job-definitions/${id}`);
    return publicJobDefinitionSchema.parse(definition);
  }

  async getSchedules(definitionId?: string): Promise<PublicJobSchedule[]> {
    const schedules = await this.request("GET", "/schedules", { definitionId });
    return z.array(publicJobScheduleSchema).parse(schedules);
  }

  async scheduleJob(
    jobId: string,
    data: unknown,
    options: ScheduleJobOptions
  ): Promise<PublicJobSchedule> {
    const newSchedule = await this.request("POST", "/schedules", {
      jobId,
      data,
      options,
    });
    return publicJobScheduleSchema.parse(newSchedule);
  }

  async getSchedule(id: number): Promise<PublicJobSchedule> {
    const schedule = await this.request("GET", `/schedules/${id}`);
    return publicJobScheduleSchema.parse(schedule);
  }

  async deleteSchedules(scheduleIds: number[]) {
    return this.request("DELETE", "/schedules", { scheduleIds });
  }

  async getRuns(scheduleId?: number): Promise<PublicJobRun[]> {
    const runs = await this.request("GET", "/runs", { scheduleId });
    return z.array(publicJobRunSchema).parse(runs);
  }

  async getRun(id: number): Promise<PublicJobRun> {
    const run = await this.request("GET", `/runs/${id}`);
    return publicJobRunSchema.parse(run);
  }

  async runSchedule(id: number): Promise<PublicJobRun> {
    const run = await this.request("POST", `/schedules/${id}/runs`);
    return publicJobRunSchema.parse(run);
  }
}
