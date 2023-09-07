const { z } = require("zod");

module.exports = async (worker) => {
  worker.registerJob({
    id: "log-job",
    title: "Log message",
    dataSchema: z.object({
      message: z.string(),
    }),
    job: async (data, console) => {
      console.log(data.message);
    },
    description: "Will print the message on the server",
    example: {
      message: "some message",
    },
  });
};
