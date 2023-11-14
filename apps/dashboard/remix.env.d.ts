/// <reference types="@remix-run/dev" />
// / <reference types="@remix-run/node" />
import type {} from "@remix-run/node";
import type { WorkerAPI } from "@enschedule/worker-api";
import type { Worker } from "@enschedule/worker";

declare module "@remix-run/node" {
  interface AppLoadContext {
    worker?: WorkerAPI | Worker;
  }
}
