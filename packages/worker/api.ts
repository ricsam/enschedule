import { PrivateBackend } from "@enschedule/pg-driver";
import express from "express";
import { z } from "zod";
import { debug } from "debug";

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
            runAt: z.date().optional(),
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

    app.delete("/schedules", (req, res, next) => {
      const idSchema = z.object({
        scheduleIds: z.array(z.number().int().positive()),
      });
      const { scheduleIds } = idSchema.parse(req.body);

      this.deleteSchedules(scheduleIds)
        .then(() => {
          res.status(200).send("Schedules deleted successfully");
        })
        .catch(next);
    });

    app.get("/runs", (req, res, next) => {
      const scheduleIdSchema = z.number().int().positive().optional();
      const validatedScheduleId = scheduleIdSchema.parse(
        Number(req.query.scheduleId)
      );
      this.getRuns(validatedScheduleId)
        .then((runs) => {
          res.json(runs);
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

    app.post("/schedules/:id/runs", (req, res, next) => {
      const idSchema = z.number().int().positive();
      const validatedId = idSchema.parse(Number(req.params.id));
      this.runSchedule(validatedId)
        .then((run) => {
          res.json(run);
        })
        .catch(next);
    });

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

    app.use(apiKeyMiddleware);

    app.use((req, res, next) => {
      res.on("finish", () => {
        log(req.method, decodeURI(req.url), res.statusCode, res.statusMessage);
      });
      next();
    });

    const { port, hostname } = serveOptions;
    const cb = () => {
      console.log(`Server is running on port ${port}`);
    };
    if (hostname) {
      app.listen(port, hostname, cb);
    } else {
      app.listen(port, cb);
    }
  }
}
