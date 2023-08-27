import { chromium, type FullConfig } from "@playwright/test";
import path from "path";
import { spawn, ChildProcess } from "child_process";
import { Client } from "pg"; // Using the 'pg' module

// Will hold the child processes for cleanup later
const childProcesses: ChildProcess[] = [];

async function createDatabase() {
  const client = new Client({
    user: process.env.PGUSER,
    host: process.env.PGHOST,
    password: process.env.PGPASSWORD,
    database: process.env.PGDATABASE,
    port: process.env.PGPORT ? Number(process.env.PGPORT) : undefined,
  });

  await client.connect();

  // Drop the database if it already exists
  await client.query("DROP DATABASE IF EXISTS playwright-test");

  // Create a new database; modify SQL as necessary
  await client.query("CREATE DATABASE playwright-test");

  await client.end();
}

async function globalSetup(config: FullConfig) {
  console.log("Running global setup");
  await createDatabase();

  // Start the first worker server
  const worker1 = spawn("pnpm", ["run", "dev"], {
    env: { ...process.env, ENSCHEDULE_API: "true" },
    stdio: "inherit",
    cwd: path.join(__dirname, "../test-worker"),
  });
  childProcesses.push(worker1);

  // Start the second worker server
  const worker2 = spawn("pnpm", ["run", "dev"], {
    env: process.env,
    stdio: "inherit",
    cwd: path.join(__dirname, "../test-worker"),
  });
  childProcesses.push(worker2);

  // Start the app server
  const appServer = spawn("pnpm", ["run dev"], {
    env: process.env,
    stdio: "inherit",
    cwd: path.join(__dirname, "../../apps/dashboard"),
  });
  childProcesses.push(appServer);
}

export default globalSetup;
