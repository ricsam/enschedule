// eslint-disable-next-line eslint-comments/disable-enable-pair
/* eslint-disable no-nested-ternary */
import "dotenv/config";
import { Worker } from "@enschedule/worker";
import add from "date-fns/add";
import { z } from "zod";
import express, { Router } from "express";

const apiKey = process.env.API_KEY;
if (!apiKey) {
  throw new Error('Please set the "API_KEY" environment variable');
}

const accessTokenSecret = process.env.ACCESS_TOKEN_SECRET;
const refreshTokenSecret = process.env.REFRESH_TOKEN_SECRET;
const nafsUri = process.env.NAFS_URI;
if (!accessTokenSecret || !refreshTokenSecret || !nafsUri) {
  throw new Error(
    'Please set the "ACCESS_TOKEN_SECRET / REFRESH_TOKEN_SECRET / NAFS_URI" environment variables'
  );
}

const worker = new Worker({
  name: process.env.SPECIAL_HANDLERS ? "Special worker" : "Test worker",
  workerId: process.env.SPECIAL_HANDLERS
    ? "special"
    : process.env.ENSCHEDULE_API
    ? "rest-test-worker"
    : "test-worker",
  description: process.env.SPECIAL_HANDLERS
    ? "Special worker, no REST API"
    : process.env.ENSCHEDULE_API
    ? "With REST API"
    : "No API",
  accessTokenSecret,
  refreshTokenSecret,
  apiKey,
  nafsUri,
});
worker.logJobs = true;
worker.retryStrategy = () => 5000;
if (!process.env.SPECIAL_HANDLERS) {
  worker.registerJob({
    id: "send-http-request",
    title: "Send HTTP request",
    dataSchema: z.object({
      url: z.string(),
    }),
    version: 1,
    job: (data) => {
      console.log("pretending to fetch", data.url);
    },
    description: "Provide HTTP parameters as data to send a request",
    example: {
      url: "http://localhost:3000",
    },
    access: {
      view: {
        users: [1],
      },
    },
  });
  worker.registerJob({
    id: "log-job",
    title: "Log message",
    dataSchema: z.object({
      message: z.string(),
    }),
    version: 1,
    job: (data) => {
      console.log(data.message);
    },
    description: "Will print the message on the server",
    example: {
      message: "some message",
    },
  });
  worker.registerJob({
    id: "error-job",
    title: "Throw message",
    dataSchema: z.object({
      message: z.string(),
    }),
    version: 1,
    job: (data) => {
      if (data.message === "no error") {
        return;
      }
      throw new Error(data.message);
    },
    description: "Will throw the message as an error",
    example: {
      message: "some error",
    },
  });
  worker.registerJob({
    id: "mix-job",
    version: 1,
    title: "Throw message and log stuff",
    dataSchema: z.object({
      message: z.string(),
    }),
    job: (data) => {
      console.log("Will throw an error now");
      throw new Error(data.message);
    },
    description: "Will throw the message as an error and log stuff",
    example: {
      message: "some message",
    },
  });
  worker.registerJob({
    id: "big-output",
    title: "This job will output a lot of data",
    dataSchema: z.any(),
    version: 1,
    job: () => {
      for (let i = 0; i < 100000; i++) {
        console.log("i", i);
      }
    },
    description: "Provide HTTP parameters as data to send a request",
    example: {
      url: "http://localhost:3000",
    },
  });
  worker.registerJob({
    id: "long-running",
    title: "This job will run for a while",
    dataSchema: z.any(),
    version: 1,
    job: async () => {
      for (let i = 0; i < 100; i++) {
        // eslint-disable-next-line no-await-in-loop
        await new Promise((resolve) => {
          setTimeout(resolve, 1000);
        });
        console.log("i", i);
      }
    },
    description: "Just run it",
    example: {
      url: "http://localhost:3000",
    },
  });
} else {
  worker.registerJob({
    id: "special-job",
    version: 1,
    title: "This is a special job",
    dataSchema: z.object({
      message: z.string(),
    }),
    job: (data) => {
      console.log("This job only runs when SPECIAL_HANDLERS is set", data);
    },
    description: "Only runs on the SPECIAL_HANDLERS worker",
    example: {
      message: "some message",
    },
  });
}

(async () => {
  const ranJob = await worker.listenForIncomingRuns();
  if (ranJob) {
    return;
  }

  if (process.env.ENSCHEDULE_API) {
    console.log("Starting the API");
    const app = express();
    const router = Router();
    router.get("/healthz", (req, res) => {
      res.send("Test endpoint is Ok");
    });
    router.get("/set-poll-interval", (req, res, next) => {
      const val = Number(req.query.pollInterval);
      if (typeof val === "number" && val > 0) {
        worker
          .updatePollInterval(val)
          .then(() => {
            return worker.getWorkers(`Api-Key ${apiKey}`);
          })
          .then((workers) => {
            res.send(
              `Updated poll interval to ${String(val)}, there are now ${
                workers.length
              } workers`
            );
          })
          .catch(next);
      } else {
        res.status(400).send("Invalid poll interval");
      }
    });
    app.use("/test", router);
    worker
      .serve(
        {
          port: process.env.API_PORT ? Number(process.env.API_PORT) : 8080,
          apiKey,
        },
        app
      )
      .listen();
  }
  console.log("Starting polling");
  await worker.startPolling({ dontMigrate: true });
  console.log("Scheduling test job");
  await worker.scheduleJob(
    `Api-Key ${apiKey}`,
    "send-http-request",
    1,
    { url: "http://localhost:3000" },
    {
      eventId: "first_event",
      runAt: add(new Date(), {
        days: 5,
      }),
      title: "Programatically Created",
      description:
        "This is an automatically created job which will run in 5 days",
    }
  );
  await worker.scheduleJob(
    `Api-Key ${apiKey}`,
    "send-http-request",
    10,
    { url: "http://localhost:3000" },
    {
      eventId: "non_existing_function",
      title: "Run on a non existing function version",
      description:
        "This is an automatically created job which will not run, because there is no function with id send-http-request and version 10",
    }
  );
  console.log("Worker up and running");
})().catch((err) => {
  console.log("@err", err);
});
