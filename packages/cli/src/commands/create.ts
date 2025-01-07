import { Command } from "commander"; // add this line
import { z } from "zod";
import {
  ScheduleJobOptionsSchema,
  ScheduleUpdatePayloadSchema,
} from "@enschedule/types";
import { getAuthHeader, getWorker } from "../get-worker";
import { getSchedule } from "../get-schedule";

export const createCommand = new Command("create");

export const createScheduleCommand = new Command("schedule");

createCommand.addCommand(createScheduleCommand);

createScheduleCommand
  .description("create schedule(s)")
  .option("-u, --update", "Perform an update", false)
  .option("--name <name>", "Name of the schedule")
  .option("--run-at <runAt>", "Run at time in ISO format")
  .option("--function-id <functionId>", "Function ID to execute")
  .option(
    "--function-version <number>",
    "Version of the function to execute",
    parseInt
  )
  .option("--data <data>", "Data to pass to the function (JSON)")
  .option("--title <title>", "Title of the schedule")
  .action(async (_options) => {
    const update = z.object({ update: z.boolean() }).parse(_options).update;
    const scheduleId = z.object({ name: z.string() }).parse(_options).name;
    const schedule = await getSchedule(scheduleId);

    if (!update && schedule) {
      throw new Error(
        "Schedule already exists. Use --update to update the schedule"
      );
    }

    if ((!update || !schedule) && scheduleId.startsWith("db:")) {
      throw new Error("You cannot create a schedule with a db id");
    }

    const action =
      update && schedule
        ? {
            type: "update" as const,
            options: ScheduleUpdatePayloadSchema.parse({
              ..._options,
              id: schedule.id,
            }),
            schedule,
          }
        : {
            type: "create" as const,
            options: {
              ...ScheduleJobOptionsSchema.parse(_options),
              eventId: scheduleId,
            },
            ...z
              .object({
                functionId: z.string(),
                functionVersion: z.number(),
                data: z.string().transform((data): unknown => JSON.parse(data)),
              })
              .parse(_options),
          };

    const authHeader = await getAuthHeader();
    const worker = await getWorker();

    if (action.type === "create") {
      await worker.scheduleJob(
        authHeader,
        action.functionId,
        action.functionVersion,
        action.data,
        action.options
      );
    } else {
      await worker.updateSchedule(authHeader, action.options);
    }
  });
