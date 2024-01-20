import { Command } from "commander"; // add this line
import { z } from "zod";
import { ScheduleSchema } from "@enschedule/types";
import { getWorker } from "../get-worker";

export const applyCommand = new Command("apply");

export const ScheduleYamlSchema = z.object({
  apiVersion: z.literal("v1"),
  kind: z.literal("schedule"),
  metadata: z.object({
    name: z.string(),
  }),
  spec: ScheduleSchema,
});

export const apply = async (
  config: z.infer<typeof ScheduleYamlSchema>
): Promise<void> => {
  const worker = await getWorker();
  const { status } = await worker.scheduleJob(
    config.spec.handlerId,
    config.spec.handlerVersion,
    config.spec.data,
    { ...config.spec.options, eventId: config.metadata.name }
  );
  console.log("Schedule", config.metadata.name, status);
};

applyCommand
  .description("Apply a schedule from a file")
  .option("-f, --file <type>", "file to apply")
  .action((options) => {
    console.log(options);
    // Logic to handle the apply action
  });
