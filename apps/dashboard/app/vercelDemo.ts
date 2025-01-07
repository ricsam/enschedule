import type { Worker } from "@enschedule/worker";
import { add, endOfMonth } from "date-fns";
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
    `Api-Key ${process.env.ENSCHEDULE_API_KEY}`,
    "long-running",
    1,
    {},
    {
      eventId: "long_running_every_night",
      cronExpression: "0 0 * * *",
      title: "Daily backups",
      description: "Run backups every night at midnight",
    }
  );

  await worker.scheduleJob(
    `Api-Key ${process.env.ENSCHEDULE_API_KEY}`,
    "send-http-request",
    1,
    { url: "http://localhost:3000" },
    {
      eventId: "pkg_audit",
      runAt: add(endOfMonth(new Date()), {
        days: 5,
      }),
      title: "Package audit",
      description: "Audit out packages 5 days after the end of this month",
    }
  );

  await worker.scheduleJob(
    `Api-Key ${process.env.ENSCHEDULE_API_KEY}`,
    "send-http-request",
    10,
    { url: "http://localhost:3000" },
    {
      eventId: "non_existing_function",
      title: "Run on a non existing function version",
      runNow: true,
      description:
        "Schedule targeting an non existing function, because there is no function with id send-http-request and version 10",
    }
  );

  await worker.scheduleJob(
    `Api-Key ${process.env.ENSCHEDULE_API_KEY}`,
    "log-job",
    1,
    { message: "Sending email" },
    {
      eventId: "send_email_in_one_week",
      cronExpression: "0 0 0 * * 1", // every monday
      title: "Weekly digest",
      description: "Send out the weekly digest email",
    }
  );

  await worker.scheduleJob(
    `Api-Key ${process.env.ENSCHEDULE_API_KEY}`,
    "log-job",
    1,
    { message: "Purging logs..." },
    {
      eventId: "purge_logs_monthly",
      cronExpression: "0 0 1 * *",
      title: "Log purger",
      description: "Purge logs every month",
    }
  );

  await worker.scheduleJob(
    `Api-Key ${process.env.ENSCHEDULE_API_KEY}`,
    "error-job",
    1,
    { message: "Failed to copy data from postgres into elasticsearch" },
    {
      eventId: "retry_job",
      title: "Copy data into elasticsearch",
      description:
        "Copy data into elastic search. Retries the job 3 times on failure",
      retryFailedJobs: true,
      maxRetries: 3,
      runNow: true,
    }
  );

  const notify = await worker.scheduleJob(
    `Api-Key ${process.env.ENSCHEDULE_API_KEY}`,
    "log-job",
    1,
    { message: "Will notify on slack..." },
    {
      eventId: "notify_on_slack",
      title: "Slack notifier",
      description: "Notify us on slack if there is an error in some job",
    }
  );

  await worker.scheduleJob(
    `Api-Key ${process.env.ENSCHEDULE_API_KEY}`,
    "error-job",
    1,
    { message: "Failed to update ssl certs" },
    {
      eventId: "error_notify",
      title: "Update ssl certs",
      description: "Update ssl certs, if it fails it will notify on slack",
      retryFailedJobs: false,
      failureTrigger: notify.schedule.id,
      cronExpression: "0 0 1 * *",
    }
  );
};
