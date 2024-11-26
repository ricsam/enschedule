import http from "node:http";
import { PrivateBackend } from "@enschedule/pg-driver";
import type { ScheduleUpdatePayload } from "@enschedule/types";
import {
  AuthHeader,
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
    let authHeader: z.infer<typeof AuthHeader> | undefined;
    const apiKey = req.get("X-API-KEY");

    const authHeaderParse = AuthHeader.safeParse(req.headers.authorization);
    if (authHeaderParse.success) {
      authHeader = authHeaderParse.data;
    } else if (apiKey && apiKey === process.env.API_KEY) {
      authHeader = `Api-Key ${apiKey}`;
    }
    if (!authHeader) {
      return res.status(401).json({ error: "Unauthorized" });
    }

    worker
      .getUserAuth(authHeader)
      .then((user) => {
        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        next();
      })
      .catch(() => {
        return res.status(401).json({ error: "Unauthorized" });
      });
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
    const authHeader = AuthHeader.safeParse(req.headers.authorization);
    if (!authHeader.success) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    worker
      .getLatestHandlers(authHeader.data)
      .then((jobDefinitions) => {
        res.json(jobDefinitions);
      })
      .catch(next);
  });

  router.get("/job-definitions/:id", (req, res, next) => {
    const authHeader = AuthHeader.safeParse(req.headers.authorization);
    if (!authHeader.success) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    worker
      .getLatestHandler(req.params.id, authHeader.data)
      .then((jobDefinition) => {
        res.json(jobDefinition);
      })
      .catch(next);
  });

  router.get("/schedules", (req, res, next) => {
    const authHeader = AuthHeader.safeParse(req.headers.authorization);
    if (!authHeader.success) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const filters = SchedulesFilterSchema.parse(req.query);
    worker
      .getSchedules(authHeader.data, filters)
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
    const authHeader = AuthHeader.safeParse(req.headers.authorization);
    if (!authHeader.success) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    worker
      .getWorkers(authHeader.data)
      .then((workers) => {
        res.json(workers);
      })
      .catch(next);
  });

  router.post("/schedules", (req, res, next) => {
    const authHeader = AuthHeader.safeParse(req.headers.authorization);
    if (!authHeader.success) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const { handlerId, data, options, handlerVersion } = ScheduleSchema.parse(
      req.body
    );
    worker
      /* eslint-disable @typescript-eslint/no-explicit-any */
      .scheduleJob(
        authHeader.data,
        handlerId,
        handlerVersion,
        data as any,
        options
      )
      .then((newSchedule) => {
        res.json(newSchedule);
      })
      .catch(next);
    /* eslint-enable @typescript-eslint/no-explicit-any */
  });

  router.get("/schedules/:id", (req, res, next) => {
    const authHeader = AuthHeader.safeParse(req.headers.authorization);
    if (!authHeader.success) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const idSchema = z.number().int().positive();
    const validatedId = idSchema.parse(Number(req.params.id));
    worker
      .getSchedule(authHeader.data, validatedId)
      .then((schedule) => {
        res.json(schedule);
      })
      .catch(next);
  });

  router.delete("/schedules/:id", (req, res, next) => {
    const authHeader = AuthHeader.safeParse(req.headers.authorization);
    if (!authHeader.success) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const idSchema = z.number().int().positive();
    const validatedId = idSchema.parse(Number(req.params.id));
    worker
      .deleteSchedule(authHeader.data, validatedId)
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
    const authHeader = AuthHeader.safeParse(req.headers.authorization);
    if (!authHeader.success) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const updatePayload: ScheduleUpdatePayload =
      ScheduleUpdatePayloadSchema.parse({
        ...req.body,
        id: Number(req.params.id),
      });
    worker
      .updateSchedule(authHeader.data, updatePayload)
      .then((updatedSchedule) => {
        res.json(updatedSchedule);
      })
      .catch(next);
  });

  router.get("/runs/:id", (req, res, next) => {
    const authHeader = AuthHeader.safeParse(req.headers.authorization);
    if (!authHeader.success) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const idSchema = z.number().int().positive();
    const validatedId = idSchema.parse(Number(req.params.id));
    worker
      .getRun(authHeader.data, validatedId)
      .then((run) => {
        res.json(run);
      })
      .catch(next);
  });

  router.delete("/runs/:id", (req, res, next) => {
    const authHeader = AuthHeader.safeParse(req.headers.authorization);
    if (!authHeader.success) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    const idSchema = z.number().int().positive();
    const validatedId = idSchema.parse(Number(req.params.id));
    worker
      .deleteRun(authHeader.data, validatedId)
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
    const authHeader = AuthHeader.safeParse(req.headers.authorization);
    if (!authHeader.success) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    worker
      .reset(authHeader.data)
      .then((success) => {
        res.json({ success });
      })
      .catch(next);
  });

  router.post("/login", (req, res, next) => {
    const { username, password } = z
      .object({
        username: z.string(),
        password: z.string(),
      })
      .parse(req.body);
    worker
      .login(username, password)
      .then((tokens) => {
        if (tokens) {
          res.json(tokens);
        } else {
          res.status(401).json({ error: "Unauthorized" });
        }
      })
      .catch(next);
  });

  router.post("/refresh-token", (req, res, next) => {
    const { refreshToken } = z
      .object({
        refreshToken: z.string(),
      })
      .parse(req.body);
    worker
      .refreshToken(refreshToken)
      .then((tokens) => {
        if (tokens) {
          res.json(tokens);
        } else {
          res.status(401).json({ error: "Unauthorized" });
        }
      })
      .catch(next);
  });

  router.get("/users/:id", (req, res, next) => {
    const idSchema = z.number().int().positive();
    const validatedId = idSchema.parse(Number(req.params.id));
    const authHeader = AuthHeader.safeParse(req.headers.authorization);
    if (!authHeader.success) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    worker
      .getUser(authHeader.data, validatedId)
      .then((user) => {
        res.json(user);
      })
      .catch(next);
  });

  router.get("/users", (req, res, next) => {
    const authHeader = AuthHeader.safeParse(req.headers.authorization);
    if (!authHeader.success) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    worker
      .getUsers(authHeader.data)
      .then((users) => {
        res.json(users);
      })
      .catch(next);
  });

  router.post("/logout", (req, res, next) => {
    const { refreshToken, allDevices } = z
      .object({
        refreshToken: z.string(),
        allDevices: z.boolean(),
      })
      .parse(req.body);
    worker
      .logout(refreshToken, allDevices)
      .then(() => {
        res.json({ success: true });
      })
      .catch(next);
  });

  router.get("/user-auth", (req, res, next) => {
    const authHeader = AuthHeader.safeParse(req.headers.authorization);
    if (!authHeader.success) {
      return res.status(401).json({ error: "Unauthorized" });
    }
    worker
      .getUserAuth(authHeader.data)
      .then((user) => {
        if (!user) {
          return res.status(401).json({ error: "Unauthorized" });
        }
        res.json(user);
      })
      .catch(next);
  });

  return router;
};

export class Worker extends PrivateBackend {
  serve(
    serveOptions: ServeOptions,
    app: express.Express = express()
  ): { listen: (cb?: (url: string) => void) => http.Server } {
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
        return server;
      },
    };
  }
}
