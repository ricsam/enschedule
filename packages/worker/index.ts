import { PrivateBackend } from "@enschedule/pg-driver";
import { serveWorker, type ServeOptions } from "./api";

export { createWorkerRouter, handleWorkerRequest, serveWorker } from "./api";

export class Worker extends PrivateBackend {
  serve(options: ServeOptions) {
    return serveWorker(this, options);
  }
}
