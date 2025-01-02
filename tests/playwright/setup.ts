import kill from "tree-kill";
import {
  ChildProcess,
  execSync,
  spawn,
  exec,
  ExecOptions,
} from "child_process";
import "dotenv/config";
import path from "path";
import http from "http";
import { Client } from "pg"; // Using the 'pg' module
import treeKill from "tree-kill";

export class Setup {
  // Will hold the child processes for cleanup later
  private childProcesses: ChildProcess[] = [];

  private dbCreds = {
    DB_USER: "postgres",
    DB_HOST: "127.0.0.1",
    DB_PASSWORD: "postgres",
    DB_DATABASE: "postgres",
    DB_PORT: "6543",
  };

  private _dashboardUrl = "";
  private _workerUrl = "";

  get dashboardUrl() {
    if (process.env.SKIP_SETUP) {
      if (!process.env.DASHBOARD_URL) {
        throw new Error(
          "If SKIP_SETUP is enabled you must also provide process.env.DASHBOARD_URL"
        );
      }
      return process.env.DASHBOARD_URL;
    }
    if (!this._dashboardUrl) {
      throw new Error("Please call setup before accessing this property");
    }
    return this._dashboardUrl;
  }

  set dashboardUrl(value: string) {
    this._dashboardUrl = value;
  }


  get workerUrl() {
    if (process.env.SKIP_SETUP) {
      if (!process.env.WORKER_URL) {
        throw new Error(
          "If SKIP_SETUP is enabled you must also provide process.env.WORKER_URL"
        );
      }
      return process.env.WORKER_URL;
    }
    if (!this._workerUrl) {
      throw new Error("Please call setup before accessing this property");
    }
    return this._workerUrl;
  }

  set workerUrl(value: string) {
    this._workerUrl = value;
  }

  private _TEST_DB = "";

  get TEST_DB() {
    if (!this._TEST_DB) {
      throw new Error("Please call setup before accessing this property");
    }
    return this._TEST_DB;
  }

  set TEST_DB(value: string) {
    this._TEST_DB = value;
  }

  private get workerEnvs() {
    return {
      ...this.dbCreds,
      POSTGRES: "true",
      DEBUG: "pg-driver,worker",
      DB_DATABASE: this.TEST_DB,
      API_KEY: "secret_key",
      ACCESS_TOKEN_SECRET: "secret_key",
      REFRESH_TOKEN_SECRET: "secret_key",
      NAFS_URI: "enstore://admin:password?endpoint=http://localhost:3456",
    };
  }

  private cwd = execSync("git rev-parse --show-toplevel").toString().trim();
  private workerPwd = path.join(this.cwd, "tests/test-worker");

  async asyncExec(
    command: string | string[],
    options?: ExecOptions & { stdout?: boolean; stderr?: boolean }
  ) {
    const result = await new Promise<string>((resolve, reject) => {
      const args = Array.isArray(command) ? command.join(" ") : command;
      const execOptions: ExecOptions = { ...options };
      const child = exec(args, execOptions, (err, result) => {
        if (err) {
          reject(err);
        } else {
          resolve(result.toString());
        }
        child.removeAllListeners();
      });

      if (options?.stdout !== false) {
        child.stdout?.pipe(process.stdout);
      }
      if (options?.stderr !== false) {
        child.stderr?.pipe(process.stderr);
      }
    });

    return result;
  }

  async createDatabase() {
    const client = new Client({
      user: this.dbCreds.DB_USER,
      host: this.dbCreds.DB_HOST,
      password: this.dbCreds.DB_PASSWORD,
      database: this.dbCreds.DB_DATABASE,
      port: Number(this.dbCreds.DB_PORT),
    });

    await client.connect();

    // Disconnect all clients from the database if it exists
    await client.query(
      `SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = '${this.TEST_DB}' AND pid <> pg_backend_pid()`
    );

    // Drop the database if it already exists
    await client.query(`DROP DATABASE IF EXISTS ${this.TEST_DB}`);

    // Create a new database; modify SQL as necessary
    await client.query(`CREATE DATABASE ${this.TEST_DB}`);

    console.log("Successfully created database", this.TEST_DB);

    console.log("Migrating", this.TEST_DB);
    await this.asyncExec("pnpm run seed", {
      env: {
        ...process.env,
        ...this.workerEnvs,
      },
      cwd: this.workerPwd,
    });

    await client.end();
  }

  async setup() {
    if (process.env.SKIP_SETUP) {
      return;
    }
    this.TEST_DB = "pw" + Math.random().toString(36).substring(2, 14) + "e";

    console.log("Running global setup");
    await this.createDatabase();

    const spawnServer = async (
      cmd: string[],
      env: (port: number) => NodeJS.ProcessEnv,
      cwd: string,
      ready: (data: any) => boolean,
      healthEndpoint: string
    ) => {
      const id = `[${cmd.join(",")} in ${path.relative(this.cwd, cwd)}]`;
      const log = (...msg: any[]) => console.log(id, ...msg);
      const getPort = async () => {
        let server = spawn("pnpm", cmd, {
          env: env(0),
          stdio: ["inherit", "pipe", "pipe"],
          cwd,
        });
        this.childProcesses.push(server);

        log(`Starting web server...`);
        // Wait for server to print some message to stdout
        return await new Promise<number>((resolve, reject) => {
          let allData = "";
          const timeout = setTimeout(() => {
            reject(new Error(`${id} Timeout after 20 seconds: ${allData}`));
          }, 20000);
          server.stdout.on("data", async (data) => {
            console.log(data.toString());
            allData += data;
            log(data.toString());
            if (ready(data)) {
              if (!server.pid) {
                throw new Error(`${id} server must have a pid`);
              }
              const pstree = await this.asyncExec("pstree -p " + server.pid, {
                stdout: false,
              });
              const childprocs = [...pstree.matchAll(/[\( ](\d+)[\) ]/g)].map(
                ([, v]) => v
              );

              let port = 0;
              await Promise.all(
                childprocs.map(async (pid) => {
                  if (port !== 0) {
                    return;
                  }
                  try {
                    const lsof = await this.asyncExec(
                      "lsof -aPi -F -p " + pid,
                      {
                        stderr: false,
                        stdout: false,
                      }
                    );
                    const match = lsof.match(/^n\*:(\d+)$/m);
                    if (!match || !match[1] || Number.isNaN(Number(match[1]))) {
                      throw new Error(`${id} could not parse lsof ${lsof}`);
                    }
                    port = Number(match[1]);
                  } catch (err) {}
                })
              );

              log(`Server running on http://localhost:${port} 🚀`);
              clearTimeout(timeout);
              resolve(port);
            }
          });
          server.stderr.on("data", (data) => {
            log(data.toString());
          });
        });
      };

      const port = await getPort();

      const waitForPort = async (port: number, endpoint: string) => {
        // Wait for the server to ready by sending a HTTP get request to /healthz until a 200 response
        let attempts = 0;
        while (true) {
          try {
            const res = await new Promise((resolve, reject) => {
              http
                .get(`http://localhost:${port}${endpoint}`, (res) => {
                  let data = "";
                  res.on("data", (chunk) => {
                    data += chunk;
                  });
                  res.on("end", () => {
                    log(endpoint, data);
                    resolve(res.statusCode);
                  });
                })
                .on("error", (err) => {
                  reject(err);
                });
            });
            log("GET", `http://localhost:${port}${endpoint}`, res);
            if (res === 200) {
              break;
            }
          } catch (err) {
            log(`Waiting server to be ready...`);
          }
          await new Promise((resolve) => setTimeout(resolve, 1000));
          attempts++;
          if (attempts > 10) {
            throw new Error(`${id} Timeout after 10 attempts`);
          }
        }
      };

      await waitForPort(port, healthEndpoint);
      return port;
    };

    const workerApiPort = await spawnServer(
      ["run", "serve"],
      (port) => ({
        ...process.env,
        ...this.workerEnvs,
        ENSCHEDULE_API: "true",
        API_PORT: String(port),
      }),
      this.workerPwd,
      (stdout) => stdout.includes("Worker up and running"),
      "/api/v1/healthz"
    );

    const dashboardPwd = path.join(this.cwd, "apps/dashboard");

    // Start the second worker server
    const worker2 = spawn("pnpm", ["run", "serve"], {
      env: { ...process.env, ...this.workerEnvs },
      stdio: ["inherit", "pipe", "inherit"],
      cwd: this.workerPwd,
    });
    this.childProcesses.push(worker2);

    console.log("Starting load worker...");
    // Wait for worker2 to print "Worker up and running" to stdout
    await new Promise<void>((resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error("Timeout after 20 seconds"));
      }, 20000);
      worker2.stdout.on("data", (data) => {
        if (data.includes("Worker up and running")) {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
    console.log("Load worker started");

    const dashboardPort = await spawnServer(
      ["run", "docker:start"],
      (port) => ({
        ...process.env,
        PORT: String(port),
        API_KEY: "secret_key",
        NODE_ENV: "production",
        DEBUG: "worker-api",
        WORKER_URL: `http://localhost:${workerApiPort}`,
        ACCESS_TOKEN_SECRET: "secret_key",
        REFRESH_TOKEN_SECRET: "secret_key",
        COOKIE_SESSION_SECRET: "s3cr3t",
        NAFS_URI: "enstore://admin:password?endpoint=http://localhost:3456",
      }),
      dashboardPwd,
      (stdout) => stdout.includes("[remix-serve] http"),
      "/healthz"
    );

    console.log(`Started dashboard on http://localhost:${dashboardPort}`);

    this.dashboardUrl = `http://localhost:${dashboardPort}`;
    this.workerUrl = `http://localhost:${workerApiPort}`;

    console.log("Setup done");
  }
  async teardown() {
    if (process.env.SKIP_SETUP) {
      return;
    }
    const terminationPromises = this.childProcesses.map((childProcess) => {
      return new Promise<void>((resolve, reject) => {
        childProcess.stdout?.removeAllListeners();
        childProcess.stdout?.pause();
        childProcess.stderr?.removeAllListeners();
        childProcess.stderr?.pause();
        childProcess.unref();
        if (childProcess.pid) {
          console.log("Terminating process pid", childProcess.pid);
          treeKill(childProcess.pid, "SIGTERM", (err) => {
            if (err) {
              reject(err);
            } else {
              resolve();
            }
          });
        }
      });
    });
    await Promise.all(terminationPromises);
    console.log("Terminated all started processes");

    // Delete the test database
    const client = new Client({
      user: this.dbCreds.DB_USER,
      host: this.dbCreds.DB_HOST,
      password: this.dbCreds.DB_PASSWORD,
      database: this.dbCreds.DB_DATABASE,
      port: Number(this.dbCreds.DB_PORT),
    });
    await client.connect();
    await client.query(`DROP DATABASE IF EXISTS ${this.TEST_DB}`);
    await client.end();
    console.log("Deleted test database", this.TEST_DB);
    this.TEST_DB = "";

    // playwright swallows the last line
    console.log("\n");
  }
}
