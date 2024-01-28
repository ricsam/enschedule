import http from "node:http";
import { PrivateBackend } from "@enschedule/pg-driver";
import type { ScheduleUpdatePayload } from "@enschedule/types";
import {
  ListRunsOptionsSerializedSchema,
  ScheduleSchema,
  ScheduleUpdatePayloadSchema,
  SchedulesFilterSchema,
} from "@enschedule/types";
import type { WorkerAPI } from "@enschedule/worker-api";
import { json as parseJsonBody } from "body-parser";
import { debug } from "debug";
import express, { Router } from "express";
import { z } from "zod";

const log = debug("worker");

export interface ServeOptions {
  port: number;
  hostname?: string;
}

export const expressRouter = (worker: WorkerAPI | PrivateBackend): Router => {
  if (!process.env.API_KEY) {
    throw new Error(
      "Environment variable API_KEY must be defined to start the API endpoint"
    );
  }

  const apiKeyMiddleware = (
    req: express.Request,
    res: express.Response,
    next: express.NextFunction
  ) => {
    const apiKey = req.get("X-API-KEY");
    if (!apiKey || apiKey !== process.env.API_KEY) {
      return res.status(403).json({ error: "Unauthorized" });
    }
    next();
  };

  const router = Router({
    strict: true,
  });

  router.get("/healthz", (req, res) => {
    res.status(200).json({ message: "Endpoint is healthy" });
  });

  router.use((req, res, next) => {
    log("Incoming", req.method, decodeURI(req.url));
    res.on("finish", () => {
      log(
        "Outgoing",
        req.method,
        decodeURI(req.url),
        res.statusCode,
        res.statusMessage
      );
    });
    next();
  });

  router.use(apiKeyMiddleware);
  router.use(parseJsonBody());

  router.get("/job-definitions", (req, res, next) => {
    worker
      .getLatestHandlers()
      .then((jobDefinitions) => {
        res.json(jobDefinitions);
      })
      .catch(next);
  });

  router.get("/job-definitions/:id", (req, res, next) => {
    worker
      .getLatestHandler(req.params.id)
      .then((jobDefinition) => {
        res.json(jobDefinition);
      })
      .catch(next);
  });

  router.get("/schedules", (req, res, next) => {
    const filters = SchedulesFilterSchema.parse(req.query);
    worker
      .getSchedules(filters)
      .then((schedules) => {
        res.json(schedules);
      })
      .catch(next);
  });

  router.post("/workers", (req, res, next) => {
    const { ids } = z.object({ ids: z.array(z.number()) }).parse(req.body);
    worker
      .deleteWorkers(ids)
      .then((deletedIds) => {
        res.json(deletedIds);
      })
      .catch(next);
  });

  router.get("/workers", (req, res, next) => {
    worker
      .getWorkers()
      .then((workers) => {
        res.json(workers);
      })
      .catch(next);
  });

  router.post("/schedules", (req, res, next) => {
    const { handlerId, data, options, handlerVersion } = ScheduleSchema.parse(
      req.body
    );

    /* eslint-disable @typescript-eslint/no-explicit-any */
    worker
      .scheduleJob(handlerId, handlerVersion, data as any, options)
      .then((newSchedule) => {
        res.json(newSchedule);
      })
      .catch(next);
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });

  router.get("/schedules/:id", (req, res, next) => {
    const idSchema = z.number().int().positive();
    const validatedId = idSchema.parse(Number(req.params.id));
    worker
      .getSchedule(validatedId)
      .then((schedule) => {
        res.json(schedule);
      })
      .catch(next);
  });

  router.delete("/schedules/:id", (req, res, next) => {
    const idSchema = z.number().int().positive();
    const validatedId = idSchema.parse(Number(req.params.id));
    worker
      .deleteSchedule(validatedId)
      .then((schedule) => {
        res.json(schedule);
      })
      .catch(next);
  });

  router.post("/delete-schedules", (req, res, next) => {
    const idSchema = z.object({
      scheduleIds: z.array(z.number().int().positive()),
    });
    const { scheduleIds } = idSchema.parse(req.body);

    worker
      .deleteSchedules(scheduleIds)
      .then((deletedIds) => {
        res.json(deletedIds);
      })
      .catch(next);
  });

  router.get("/runs", (req, res, next) => {
    const options = ListRunsOptionsSerializedSchema.parse(req.query);
    worker
      .getRuns(options)
      .then((runs) => {
        res.json(runs);
      })
      .catch(next);
  });

  router.put("/schedules/:id", (req, res, next) => {
    const updatePayload: ScheduleUpdatePayload =
      ScheduleUpdatePayloadSchema.parse({
        ...req.body,
        id: Number(req.params.id),
      });
    worker
      .updateSchedule(updatePayload)
      .then((updatedSchedule) => {
        res.json(updatedSchedule);
      })
      .catch(next);
  });

  router.get("/runs/:id", (req, res, next) => {
    const idSchema = z.number().int().positive();
    const validatedId = idSchema.parse(Number(req.params.id));
    worker
      .getRun(validatedId)
      .then((run) => {
        res.json(run);
      })
      .catch(next);
  });

  router.delete("/runs/:id", (req, res, next) => {
    const idSchema = z.number().int().positive();
    const validatedId = idSchema.parse(Number(req.params.id));
    worker
      .deleteRun(validatedId)
      .then((run) => {
        res.json(run);
      })
      .catch(next);
  });

  router.post("/delete-runs", (req, res, next) => {
    const idSchema = z.object({
      runIds: z.array(z.number().int().positive()),
    });
    const { runIds } = idSchema.parse(req.body);

    worker
      .deleteRuns(runIds)
      .then((deletedIds) => {
        res.json(deletedIds);
      })
      .catch(next);
  });

  router.post("/schedules/:id/runs", (req, res, next) => {
    const idSchema = z.number().int().positive();
    const validatedId = idSchema.parse(Number(req.params.id));
    worker
      .runScheduleNow(validatedId)
      .then(() => {
        res.json({ success: true });
      })
      .catch(next);
  });

  router.post("/runs-schedules", (req, res, next) => {
    const idSchema = z.number().int().positive();
    const validatedIds = z.array(idSchema).parse(req.body);
    worker
      .runSchedulesNow(validatedIds)
      .then(() => {
        res.json({ success: true });
      })
      .catch(next);
  });

  router.post("/unschedule", (req, res, next) => {
    const idSchema = z.number().int().positive();
    const validatedIds = z.array(idSchema).parse(req.body);
    worker
      .unschedule(validatedIds)
      .then(() => {
        res.json({ success: true });
      })
      .catch(next);
  });

  router.delete("/", (req, res, next) => {
    worker
      .reset()
      .then(() => {
        res.json({ success: true });
      })
      .catch(next);
  });
  return router;
};

export class Worker extends PrivateBackend {
  serve(
    serveOptions: ServeOptions,
    app: express.Express = express()
  ): { listen: (cb?: (url: string) => void) => void } {
    const router = expressRouter(this);

    app.use("/api/v1", router);

    return {
      listen: (cb) => {
        const { port, hostname } = serveOptions;
        const server = http.createServer(app);
        const onListen = () => {
          const ad = server.address();
          const host =
            typeof ad === "string"
              ? ad
              : `${
                  !ad?.address || ad.address === "::" ? "localhost" : ad.address
                }:${ad?.port || port}`;
          const url = `http://${host}`;
          console.log(`Worker API is running on ${url}`);
          if (cb) {
            cb(url);
          }
        };
        if (hostname) {
          server.listen(port, hostname, onListen);
        } else {
          server.listen(port, onListen);
        }
      },
    };
  }
}
