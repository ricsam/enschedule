import { z } from "zod";

export default async function register(worker) {
  worker.registerJob({
    id: "log-job",
    version: 1,
    title: "Log message",
    dataSchema: z.object({ message: z.string() }),
    job: (data) => console.log(data.message),
    description: "Will print the message on the server",
    example: { message: "some message" },
  });
}
