const { z } = require("zod");
const { text } = require('node:stream/consumers');

module.exports = async (worker) => {
  worker.registerJob({
    id: "send-http-request",
    version: 1,
    title: "Send HTTP request",
    dataSchema: z.object({
      url: z.string(),
      method: z
        .union([
          z.literal("GET"),
          z.literal("POST"),
          z.literal("PUT"),
          z.literal("DELETE"),
        ])
        .optional(),
      headers: z.record(z.string()).optional(),
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
      const body = await text(result.body);
      console.log("body", body);
    },
    description: "Provide HTTP parameters as data to send a request",
    example: {
      url: "http://localhost:3000",
    },
  });
};
