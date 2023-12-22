import type { Worker } from "@enschedule/worker";
import { z } from "zod";

export default (worker: Worker) => {
  worker.registerJob({
    id: "send-http-request",
    version: 1,
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
  });
  worker.registerJob({
    id: "log-job",
    version: 1,
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
  });
  worker.registerJob({
    id: "error-job",
    version: 1,
    title: "Throw message",
    dataSchema: z.object({
      message: z.string(),
    }),
    job: (data) => {
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
};
