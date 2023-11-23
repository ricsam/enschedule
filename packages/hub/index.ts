import path from "node:path";
import { build, dirname } from "@enschedule/dashboard";
import { PrivateBackend } from "@enschedule/pg-driver";
import type { JobDefinition } from "@enschedule/types";
import { expressRouter } from "@enschedule/worker";
import { WorkerAPI } from "@enschedule/worker-api";
import type { AppLoadContext } from "@remix-run/node";
import {
  createReadableStreamFromReadable,
  createRequestHandler as createRemixRequestHandler,
  writeReadableStreamToWritable,
} from "@remix-run/node";
import compression from "compression";
import "dotenv/config";
import type { Express } from "express";
import express, { Router, static as expressStatic } from "express";
import morgan from "morgan";
import type { ZodType } from "zod";

/**
 * A function that returns the value to use as `context` in route `loader` and
 * `action` functions.
 *
 * You can think of this as an escape hatch that allows you to pass
 * environment/platform-specific values through to your loader/action, such as
 * values that are generated by Express middleware like `req.session`.
 */
type GetLoadContextFunction = (
  req: express.Request,
  res: express.Response
) => Promise<AppLoadContext> | AppLoadContext;

type RequestHandler = (
  req: express.Request,
  res: express.Response,
  next: express.NextFunction
) => Promise<void>;

/**
 * Returns a request handler for Express that serves the response using Remix.
 */
function createRequestHandler({
  getLoadContext,
  mode = process.env.NODE_ENV,
}: {
  getLoadContext?: GetLoadContextFunction;
  mode?: string;
}): RequestHandler {
  const handleRequest = createRemixRequestHandler(build, mode);

  return async (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    try {
      const request = createRemixRequest(req, res);
      const loadContext = await getLoadContext?.(req, res);

      const response = await handleRequest(request, loadContext);

      await sendRemixResponse(res, response);
    } catch (error: unknown) {
      // Express doesn't support async functions, so we have to pass along the
      // error manually using next().
      next(error);
    }
  };
}

function createRemixHeaders(
  requestHeaders: express.Request["headers"]
): Headers {
  const headers = new Headers();

  for (const [key, values] of Object.entries(requestHeaders)) {
    if (values) {
      if (Array.isArray(values)) {
        for (const value of values) {
          headers.append(key, value);
        }
      } else {
        headers.set(key, values);
      }
    }
  }

  return headers;
}

function createRemixRequest(
  req: express.Request,
  res: express.Response
): Request {
  // req.hostname doesn't include port information so grab that from
  // `X-Forwarded-Host` or `Host`
  const [, hostnamePort] = req.get("X-Forwarded-Host")?.split(":") ?? [];
  const [, hostPort] = req.get("host")?.split(":") ?? [];
  const port = hostnamePort || hostPort;
  // Use req.hostname here as it respects the "trust proxy" setting
  const resolvedHost = `${req.hostname}${port ? `:${port}` : ""}`;
  console.log("req.url", req.url);
  const url = new URL(`${req.protocol}://${resolvedHost}${req.url}`);

  // Abort action/loaders once we can no longer write a response
  const controller = new AbortController();
  res.on("close", () => controller.abort());

  const init: RequestInit = {
    method: req.method,
    headers: createRemixHeaders(req.headers),
    signal: controller.signal,
  };

  if (req.method !== "GET" && req.method !== "HEAD") {
    init.body = createReadableStreamFromReadable(req);
    (init as { duplex: "half" }).duplex = "half";
  }

  return new Request(url.href, init);
}

async function sendRemixResponse(
  res: express.Response,
  nodeResponse: Response
): Promise<void> {
  res.statusMessage = nodeResponse.statusText;
  res.status(nodeResponse.status);

  for (const [key, value] of nodeResponse.headers.entries()) {
    res.append(key, value);
  }

  if (nodeResponse.headers.get("Content-Type")?.match(/text\/event-stream/i)) {
    res.flushHeaders();
  }

  if (nodeResponse.body) {
    await writeReadableStreamToWritable(nodeResponse.body, res);
  } else {
    res.end();
  }
}

interface EnscheduleOptions {
  worker:
    | {
        type: "inline";
        filename: string;
      }
    | {
        type: "external";
        url: string;
        apiKey: string;
      };
  dashboard?: boolean;
  api?: boolean;
  handlers?: JobDefinition[];
  logJobs?: boolean;
  retryStrategy?: () => number;
}

export const createHandler = <T extends ZodType = ZodType>(
  job: JobDefinition<T>
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
): JobDefinition<any> => {
  return job;
};

export const enschedule = async (
  options: EnscheduleOptions
): Promise<Express | undefined> => {
  let worker: undefined | WorkerAPI | PrivateBackend;
  if (options.worker.type === "external") {
    worker = new WorkerAPI(options.worker.apiKey, options.worker.url);
  } else {
    const iWorker = new PrivateBackend({
      forkArgv: [options.worker.filename, "__enschedule_worker_launch__"],
    });
    iWorker.logJobs = true;
    iWorker.retryStrategy = () => 5000;

    options.handlers?.forEach((handler) => {
      iWorker.registerJob(handler);
    });

    if (process.argv[2] === "__enschedule_worker_launch__") {
      const ranJob = await iWorker.listenForIncomingRuns();
      if (ranJob) {
        return undefined;
      }
    }

    await iWorker.startPolling();
    worker = iWorker;
  }

  const app = express();

  app.disable("x-powered-by");

  if (options.api) {
    app.use("/api/v1", expressRouter(worker));
  }

  if (options.dashboard) {
    // needs to handle all verbs (GET, POST, etc.)
    app.use(dashboardRouter(worker));
  }

  return app;
};

function dashboardRouter(worker: WorkerAPI | PrivateBackend) {
  const handler = createRequestHandler({
    // return anything you want here to be available as `context` in your
    // loaders and actions. This is where you can bridge the gap between Remix
    // and your server
    getLoadContext(_req, _res) {
      return {
        worker,
      };
    },
    mode: build.mode,
  });

  const router = Router();
  router.use(compression());
  router.use(
    build.publicPath,
    expressStatic(path.join(dirname, build.assetsBuildDirectory), {
      immutable: true,
      maxAge: "1y",
    })
  );

  router.use(expressStatic(path.join(dirname, "public"), { maxAge: "1h" }));

  router.use(morgan("tiny"));
  // needs to handle all verbs (GET, POST, etc.)
  router.all("*", (req, res, next) => {
    handler(req, res, next)
      .then(() => {
        // handled
      })
      .catch(next);
  });

  return router;
}