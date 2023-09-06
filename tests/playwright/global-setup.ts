import { type FullConfig } from "@playwright/test";
import { ChildProcess, execSync, spawn } from "child_process";
import path from "path";
import "dotenv/config";
import { Client } from "pg"; // Using the 'pg' module

// Will hold the child processes for cleanup later
const childProcesses: ChildProcess[] = [];

const workerEnvs = {
  PGUSER: "postgres",
  PGHOST: "127.0.0.1",
  PGPASSWORD: "postgres",
  PGDATABASE: "playwrighttest",
  PGPORT: "6543",
};

async function createDatabase() {
  const client = new Client({
    user: workerEnvs.PGUSER,
    host: workerEnvs.PGHOST,
    password: workerEnvs.PGPASSWORD,
    database: "postgres",
    port: Number(workerEnvs.PGPORT),
  });

  await client.connect();

  // Disconnect all clients from the database if it exists
  await client.query(
    "SELECT pg_terminate_backend(pg_stat_activity.pid) FROM pg_stat_activity WHERE pg_stat_activity.datname = 'playwrighttest' AND pid <> pg_backend_pid()"
  );

  // Drop the database if it already exists
  await client.query("DROP DATABASE IF EXISTS playwrighttest");

  // Create a new database; modify SQL as necessary
  await client.query("CREATE DATABASE playwrighttest");

  await client.end();
}

// Function to find an open port
async function getOpenPort(startPort: number) {
  while (true) {
    try {
      await new Promise((resolve, reject) => {
        const server = require("net").createServer();
        server.unref();
        server.on("error", reject);
        server.listen(startPort, () => {
          server.close(resolve);
        });
      });
      return startPort;
    } catch (err) {
      startPort++;
    }
  }
}

async function globalSetup(config: FullConfig) {
  console.log("Running global setup");
  await createDatabase();

  // Find an open port
  const workerApiPort = await getOpenPort(3000);
  console.log(`Found open port for the worker API: ${workerApiPort}`);

  const cwd = execSync("git rev-parse --show-toplevel").toString().trim();
  const workerPwd = path.join(cwd, "tests/test-worker");
  const dashboardPwd = path.join(cwd, "apps/dashboard");

  // Start the first worker server
  const worker1 = spawn("pnpm", ["run", "serve"], {
    env: {
      ...process.env,
      ...workerEnvs,
      ENSCHEDULE_API: "true",
      PORT: String(workerApiPort),
    },
    stdio: ["inherit", "pipe", "inherit"],
    cwd: workerPwd,
  });
  childProcesses.push(worker1);

  console.log("Starting API worker...");
  // Wait for worker1 to print "Worker up and running" to stdout
  await new Promise<void>((resolve) => {
    worker1.stdout.on("data", (data) => {
      if (data.includes("Worker up and running")) {
        resolve();
      }
    });
  });
  console.log("API worker started");

  // Start the second worker server
  const worker2 = spawn("pnpm", ["run", "serve"], {
    env: { ...process.env, ...workerEnvs },
    stdio: ["inherit", "pipe", "inherit"],
    cwd: workerPwd,
  });
  childProcesses.push(worker2);

  console.log("Starting load worker...");
  // Wait for worker2 to print "Worker up and running" to stdout
  await new Promise<void>((resolve) => {
    worker2.stdout.on("data", (data) => {
      if (data.includes("Worker up and running")) {
        resolve();
      }
    });
  });
  console.log("Load worker started");

  const dashboardPort = await getOpenPort(3000);
  console.log(`Found open port for the dashboard: ${dashboardPort}`);

  // Start the dashboard server
  const appServer = spawn("pnpm", ["run", "dev"], {
    env: {
      ...process.env,
      PORT: String(dashboardPort),
      WORKER_URL: `http://localhost:${workerApiPort}`,
    },
    stdio: ["inherit", "pipe", "inherit"],
    cwd: dashboardPwd,
  });
  childProcesses.push(appServer);


  console.log("Starting dashboard...");
  await new Promise<void>((resolve) => {
    appServer.stdout.on("data", (data) => {
      if (data.includes("Remix App Server started at")) {
        resolve();
      }
    });
  });

  console.log(`Started dashboard on http://localhost:${dashboardPort}`);

  process.env.WORKER_API_PORT = String(workerApiPort);
  process.env.DASHBOARD_PORT = String(dashboardPort);

  const pids = childProcesses.map((p) => p.pid);

  if (pids.includes(undefined)) {
    throw new Error("Some child process failed to spawn :(");
  }
  console.log('Storing pids:', ...pids);
  process.env.PIDS = pids.join(",");
}

export default globalSetup;
