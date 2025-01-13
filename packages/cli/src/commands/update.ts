import { ScheduleUpdatePayloadSchema } from "@enschedule/types";
import { Command } from "commander"; // add this line
import { z } from "zod";
import { getSchedule } from "../get-schedule";
import { getAuthHeader, getWorker } from "../get-worker";

export const updateCommand = new Command("update");

export const updateScheduleCommand = new Command("schedule");

updateCommand.addCommand(updateScheduleCommand);

updateScheduleCommand
  .description("update schedule(s)")
  .argument("<name>", "Name of the schedule")
  .option("--run-at [runAt]", "Run at time in ISO format")
  .option("--run-now", "Run the schedule now", false)
  .option(
    "--function-version <number>",
    "Version of the function to execute",
    parseInt
  )
  .option("--data [data]", "Data to pass to the function (JSON)")
  .option("--title [title]", "Title of the schedule")
  .option("--description [description]", "Description of the schedule")
  .action(async (name, _options) => {
    const scheduleId = z.string().parse(name);
    const schedule = await getSchedule(scheduleId);

    if (!schedule) {
      throw new Error("Schedule not found");
    }

    const options = ScheduleUpdatePayloadSchema.parse({
      ..._options,
      id: schedule.id,
    });

    const authHeader = await getAuthHeader();
    const worker = await getWorker();

    await worker.updateSchedule(authHeader, options);
    console.log("Schedule", scheduleId, "updated");
  });
