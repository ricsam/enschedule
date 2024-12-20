import type { Worker } from "@enschedule/worker";
import { add } from "date-fns";
import { z } from "zod";

export const registerDemoFunctionsAndSchedules = async (worker: Worker) => {
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

  await worker.scheduleJob(
    `Api-Key ${process.env.API_KEY}`,
    "long-running",
    1,
    {},
    {
      eventId: "long_running_every_night",
      cronExpression: "0 0 * * *",
      title: "Daily job",
      description: "Run every night at midnight",
    }
  );

  await worker.scheduleJob(
    `Api-Key ${process.env.API_KEY}`,
    "send-http-request",
    1,
    { url: "http://localhost:3000" },
    {
      eventId: "first_event",
      runAt: add(new Date(), {
        days: 5,
      }),
      title: "Send an http request in 5 days",
      description: "Send http request in 5 days",
    }
  );

  await worker.scheduleJob(
    `Api-Key ${process.env.API_KEY}`,
    "send-http-request",
    10,
    { url: "http://localhost:3000" },
    {
      eventId: "non_existing_function",
      title: "Run on a non existing function version",
      description:
        "Schedule targeting an non existing function, because there is no function with id send-http-request and version 10",
    }
  );

  await worker.scheduleJob(
    `Api-Key ${process.env.API_KEY}`,
    "log-job",
    1,
    { message: "Sending email" },
    {
      eventId: "send_email_in_one_week",
      runAt: add(new Date(), {
        weeks: 1,
      }),
      title: "Send email in one week",
      description: "Will send emails in one week",
    }
  );

  await worker.scheduleJob(
    `Api-Key ${process.env.API_KEY}`,
    "log-job",
    1,
    { message: "Purging activity logs" },
    {
      eventId: "purge_activity_logs_monthly",
      cronExpression: "0 0 1 * *",
      title: "Purge activity logs every month",
      description: "Will log purging activity logs every month",
    }
  );

  await worker.scheduleJob(
    `Api-Key ${process.env.API_KEY}`,
    "error-job",
    1,
    { message: "no error" },
    {
      eventId: "no_error",
      title: "Run without error",
      description: "Will retry the job 3 times",
      retryFailedJobs: true,
      maxRetries: 3,
    }
  );

  const notify = await worker.scheduleJob(
    `Api-Key ${process.env.API_KEY}`,
    "log-job",
    1,
    { message: "Will notify on slack..." },
    {
      eventId: "notify_on_slack",
      title: "Run without error",
      description: "Will notify us on slack if there is an error in some job",
    }
  );

  await worker.scheduleJob(
    `Api-Key ${process.env.API_KEY}`,
    "error-job",
    1,
    { message: "some error" },
    {
      eventId: "error_notify",
      title: "Run with error",
      description: "Will fail the job",
      retryFailedJobs: false,
      failureTrigger: notify.schedule.id,
    }
  );
};
