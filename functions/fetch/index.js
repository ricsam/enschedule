import { z } from "zod";

export default async function register(worker) {
  worker.registerJob({
    id: "send-http-request",
    version: 1,
    title: "Send HTTP request",
    dataSchema: z.object({
      url: z.string(),
      method: z.enum(["GET", "POST", "PUT", "DELETE"]).optional(),
      headers: z.record(z.string(), z.string()).optional(),
      body: z.string().optional(),
    }),
    job: async (data) => {
      const result = await fetch(data.url, {
        method: data.method,
        headers: data.headers,
        body: data.body,
      });
      console.log("status", result.status);
      console.log("headers", Object.fromEntries(result.headers.entries()));
      console.log("body", await result.text());
    },
    description: "Provide HTTP parameters as data to send a request",
    example: { url: "http://localhost:3000" },
  });
}
