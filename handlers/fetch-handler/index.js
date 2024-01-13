const { z } = require("zod");

module.exports = async (worker) => {
  worker.registerJob({
    id: "send-http-request",
    version: 1,
    title: "Send HTTP request",
    dataSchema: z.object({
      url: z.string(),
    }),
    job: async (data) => {
      const result = await fetch(data.url);
      const jsonData = await result.json();
      console.log(jsonData);
    },
    description: "Provide HTTP parameters as data to send a request",
    example: {
      url: "http://localhost:3000",
    },
  });
};
