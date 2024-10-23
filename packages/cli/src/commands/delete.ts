import { Command } from "commander"; // add this line
import { getAuthHeader, getWorker } from "../get-worker";

export const deleteCommand = new Command("delete");

export const deleteScheduleCommand = new Command("schedule");

deleteCommand.addCommand(deleteScheduleCommand);

deleteScheduleCommand
  .description("Delete schedule(s)")
  .argument("<scheduleId> [moreScheduleIds...]", "id of the schedule to delete")
  .action(async (scheduleIds: string[]) => {
    const authHeader = await getAuthHeader();
    const worker = await getWorker();
    /* eslint-disable no-await-in-loop */
    for (const id of scheduleIds) {
      if (id.startsWith("db:")) {
        const dbId = id.substring(3);
        await worker.deleteSchedule(authHeader, parseInt(dbId, 10));
        console.log(`Deleted schedule with id: ${id}`);
        continue;
      }
      const schedules = await worker.getSchedules(authHeader, { eventId: id });
      if (schedules.length === 0) {
        console.log(`Schedule ${id} not found`);
        continue;
      }
      for (const schedule of schedules) {
        await worker.deleteSchedule(authHeader, schedule.id);
        console.log(
          `Deleted schedule with id: db:${schedule.id} (event: ${id})`
        );
      }
    }
    /* eslint-enable no-await-in-loop */
  });
