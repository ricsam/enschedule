import "dotenv/config";
import { createHandler, enschedule } from "@enschedule/hub";
import { z } from "zod";

(async () => {
  const app = await enschedule({
    api: true,
    dashboard: true,
    logJobs: true,
    retryStrategy: () => 5000,
    handlers: [
      createHandler({
        id: "send-http-request",
        title: "Send HTTP request",
        dataSchema: z.object({
          url: z.string(),
        }),
        job: (data) => {
          console.log("pretending to fetch", data.url);
        },
        description: "Provide HTTP parameters as data to send a request",
        example: {
          url: "http://localhost:3000",
        },
      }),
      createHandler({
        id: "log-job",
        title: "Log message",
        dataSchema: z.object({
          message: z.string(),
        }),
        job: (data) => {
          console.log(data.message);
        },
        description: "Will print the message on the server",
        example: {
          message: "some message",
        },
      }),
      createHandler({
        id: "error-job",
        title: "Throw message",
        dataSchema: z.object({
          message: z.string(),
        }),
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
      }),
      createHandler({
        id: "mix-job",
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
      }),
    ],
  });
  if (app) {
    app.listen(3000, () => {
      console.log("Listening on http://localhost:3000");
    });
  }
})()
  .then(() => {
    // void ignore
  })
  .catch(console.error);
