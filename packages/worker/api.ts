import http from "node:http";
import { PrivateBackend } from "@enschedule/pg-driver";
import type { ScheduleUpdatePayload } from "@enschedule/types";
import {
  OptionalDateSchema,
  ScheduleUpdatePayloadSchema,
} from "@enschedule/types";
import express from "express";
import { z } from "zod";
import { debug } from "debug";
import { json as parseJsonBody } from "body-parser";

const log = debug("worker");

export interface ServeOptions {
  port: number;
  hostname?: string;
}

export class Worker extends PrivateBackend {
  serve(serveOptions: ServeOptions): void {
    if (!process.env.API_KEY) {
      throw new Error(
        "Environment variable API_KEY must be defined to start the API endpoint"
      );
    }
    const app = express();

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

    app.get("/healthz", (req, res) => {
      res.status(200).json({ message: "Endpoint is healthy" });
    });

    app.use((req, res, next) => {
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

    app.use(apiKeyMiddleware);
    app.use(parseJsonBody());

    app.get("/job-definitions", (req, res) => {
      const jobDefinitions = this.getDefinitions();
      res.json(jobDefinitions);
    });

    app.get("/job-definitions/:id", (req, res) => {
      const jobDefinition = this.getJobDefinition(req.params.id);
      res.json(jobDefinition);
    });

    app.get("/schedules", (req, res, next) => {
      const querySchema = z.object({
        definitionId: z.string().optional(),
      });
      const validatedQuery = querySchema.parse(req.query);
      this.getSchedules(validatedQuery.definitionId)
        .then((schedules) => {
          res.json(schedules);
        })
        .catch(next);
    });

    app.post("/schedules", (req, res, next) => {
      const ScheduleSchema = z.object({
        jobId: z.string(),
        data: z.unknown(),
        options: z
          .object({
            cronExpression: z.string().optional(),
            runAt: OptionalDateSchema,
            eventId: z.string().optional(),
            title: z.string(),
            description: z.string(),
          })
          .optional(),
      });
      const { jobId, data, options } = ScheduleSchema.parse(req.body);
      this.scheduleJob(jobId, data, options)
        .then((newSchedule) => {
          res.json(newSchedule);
        })
        .catch(next);
    });

    app.get("/schedules/:id", (req, res, next) => {
      const idSchema = z.number().int().positive();
      const validatedId = idSchema.parse(Number(req.params.id));
      this.getSchedule(validatedId)
        .then((schedule) => {
          res.json(schedule);
        })
        .catch(next);
    });

    app.delete("/schedules/:id", (req, res, next) => {
      const idSchema = z.number().int().positive();
      const validatedId = idSchema.parse(Number(req.params.id));
      this.deleteSchedule(validatedId)
        .then((schedule) => {
          res.json(schedule);
        })
        .catch(next);
    });

    app.post("/delete-schedules", (req, res, next) => {
      const idSchema = z.object({
        scheduleIds: z.array(z.number().int().positive()),
      });
      const { scheduleIds } = idSchema.parse(req.body);

      this.deleteSchedules(scheduleIds)
        .then((deletedIds) => {
          res.json(deletedIds);
        })
        .catch(next);
    });

    app.get("/runs", (req, res, next) => {
      const scheduleIdSchema = z
        .string()
        .optional()
        .transform((strNumber) =>
          strNumber
            ? z.number().int().positive().parse(Number(strNumber))
            : undefined
        );
      const validatedScheduleId = scheduleIdSchema.parse(req.query.scheduleId);
      this.getRuns({ scheduleId: validatedScheduleId })
        .then((runs) => {
          res.json(runs);
        })
        .catch(next);
    });

    app.put("/schedules/:id", (req, res, next) => {
      const updatePayload: ScheduleUpdatePayload =
        ScheduleUpdatePayloadSchema.parse({
          ...req.body,
          id: Number(req.params.id),
        });
      this.updateSchedule(updatePayload)
        .then((updatedSchedule) => {
          res.json(updatedSchedule);
        })
        .catch(next);
    });

    app.get("/runs/:id", (req, res, next) => {
      const idSchema = z.number().int().positive();
      const validatedId = idSchema.parse(Number(req.params.id));
      this.getRun(validatedId)
        .then((run) => {
          res.json(run);
        })
        .catch(next);
    });

    app.delete("/runs/:id", (req, res, next) => {
      const idSchema = z.number().int().positive();
      const validatedId = idSchema.parse(Number(req.params.id));
      this.deleteRun(validatedId)
        .then((run) => {
          res.json(run);
        })
        .catch(next);
    });

    app.post("/delete-runs", (req, res, next) => {
      const idSchema = z.object({
        runIds: z.array(z.number().int().positive()),
      });
      const { runIds } = idSchema.parse(req.body);

      this.deleteRuns(runIds)
        .then((deletedIds) => {
          res.json(deletedIds);
        })
        .catch(next);
    });

    app.post("/schedules/:id/runs", (req, res, next) => {
      const idSchema = z.number().int().positive();
      const validatedId = idSchema.parse(Number(req.params.id));
      this.runScheduleNow(validatedId)
        .then(() => {
          res.json({ success: true });
        })
        .catch(next);
    });

    app.post("/runs-schedules", (req, res, next) => {
      const idSchema = z.number().int().positive();
      const validatedIds = z.array(idSchema).parse(req.body);
      this.runSchedulesNow(validatedIds)
        .then(() => {
          res.json({ success: true });
        })
        .catch(next);
    });

    app.post("/unschedule", (req, res, next) => {
      const idSchema = z.number().int().positive();
      const validatedIds = z.array(idSchema).parse(req.body);
      this.unschedule(validatedIds)
        .then(() => {
          res.json({ success: true });
        })
        .catch(next);
    });

    app.delete("/", (req, res, next) => {
      this.reset()
        .then(() => {
          res.json({ success: true });
        })
        .catch(next);
    });

    const { port, hostname } = serveOptions;
    const server = http.createServer(app);
    const cb = () => {
      const ad = server.address();
      const host =
        typeof ad === "string"
          ? ad
          : `${
              !ad?.address || ad.address === "::" ? "localhost" : ad.address
            }:${ad?.port || port}`;
      console.log(`Worker API is running on http://${host}`);
    };
    if (hostname) {
      server.listen(port, hostname, cb);
    } else {
      server.listen(port, cb);
    }
  }
}
