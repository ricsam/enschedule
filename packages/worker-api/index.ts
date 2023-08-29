import https from "node:https";
import http from "node:http";
import type { PublicJobSchedule, ScheduleJobOptions } from "@enschedule/types";

export class WorkerAPI {
  private hostname: string;
  private apiKey: string;
  private ssl: boolean;
  private port: number;

  /**
   *
   * @param apiKey - The API_KEY environment variable provided to the worker
   * @param hostname - The hostname of the worker e.g. localhost or my-worker.localdomain.localhost
   * @param ssl - boolean if you are using https://
   * @param port - if `worker.serve({ port: 8080 });` then 8080 is the port
   */
  constructor(apiKey: string, hostname: string, ssl: boolean, port: number) {
    this.hostname = hostname;
    this.apiKey = apiKey;
    this.ssl = ssl;
    this.port = port;
  }

  private async request(method: string, path: string, data?: unknown) {
    const options = {
      hostname: this.hostname,
      port: this.port,
      path,
      method,
      headers: {
        "Content-Type": "application/json",
        "X-API-KEY": this.apiKey,
      },
    };

    return new Promise((resolve, reject) => {
      const req = (this.ssl ? https : http).request(options, (res) => {
        let body = "";
        res.on("data", (chunk) => {
          body += chunk;
        });
        res.on("end", () => resolve(JSON.parse(body)));
      });

      req.on("error", reject);
      if (data) {
        req.write(JSON.stringify(data));
      }
      req.end();
    });
  }

  async getJobDefinitions() {
    return this.request("GET", "/job-definitions");
  }

  async getJobDefinition(id: string) {
    return this.request("GET", `/job-definitions/${id}`);
  }

  async getSchedules(definitionId?: string): Promise<PublicJobSchedule[]> {
    const schedules = await this.request("GET", "/schedules", { definitionId });
    return schedules as PublicJobSchedule[];
  }

  async scheduleJob(jobId: string, data: unknown, options: ScheduleJobOptions) {
    return this.request("POST", "/schedules", { jobId, data, options });
  }

  async getSchedule(id: number) {
    return this.request("GET", `/schedules/${id}`);
  }

  async deleteSchedules(scheduleIds: number[]) {
    return this.request("DELETE", "/schedules", { scheduleIds });
  }

  async getRuns(scheduleId?: number) {
    return this.request("GET", "/runs", { scheduleId });
  }

  async getRun(id: number) {
    return this.request("GET", `/runs/${id}`);
  }

  async runSchedule(id: number) {
    return this.request("POST", `/schedules/${id}/runs`);
  }
}
