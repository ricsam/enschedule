import type { PublicJobSchedule } from "@enschedule/types";
import { ScheduleStatus } from "@enschedule/types";
import Table from "cli-table";
import { Command } from "commander"; // add this line
import { getAuthHeader, getWorker } from "../get-worker";

export const getCommand = new Command("get");

export const getScheduleCommand = new Command("schedule");
export const getSchedulesCommand = new Command("schedules");

getCommand.addCommand(getScheduleCommand);
getCommand.addCommand(getSchedulesCommand);

getScheduleCommand
  .description("Get a schedule by id")
  .argument("<scheduleId>", "id of the schedule to get")
  .option("-o, --output <type>", "output format")
  .action(async (scheduleId: string, options: { output?: string }) => {
    const authHeader = await getAuthHeader();
    const worker = await getWorker();
    if (scheduleId.startsWith("db:")) {
      const dbId = scheduleId.substring(3);
      const schedule = await worker.getSchedule(authHeader, parseInt(dbId, 10));
      printSchedules([schedule], { ...options, single: true });
      return;
    }
    const schedules = await worker.getSchedules(authHeader, {
      eventId: scheduleId,
    });
    if (schedules.length === 0) {
      console.log(`Schedule ${scheduleId} not found`);
      return;
    }
    printSchedules(schedules, { ...options, single: true });
  });

const getHumanTime = (ms: number) => {
  const seconds = Math.floor(ms / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  const showSeconds = minutes < 1 && hours < 1 && days < 1;

  if (showSeconds) {
    return `${seconds % 60}s`;
  }

  let humanTime = "";
  if (days > 0) {
    humanTime += `${days}d `;
  }
  if (hours > 0 || days > 0) {
    humanTime += `${hours % 24}h `;
  }
  if (minutes > 0 || hours > 0 || days > 0) {
    humanTime += `${Math.round(minutes + (seconds % 60) / 60) % 60}m `;
  }

  return humanTime;
};

const verboseScheduleStatus: Record<ScheduleStatus, string> = {
  [ScheduleStatus.SUCCESS]: "Success",
  [ScheduleStatus.FAILED]: "Failed",
  [ScheduleStatus.RETRYING]: "Retrying",
  [ScheduleStatus.SCHEDULED]: "Scheduled",
  [ScheduleStatus.UNSCHEDULED]: "Unscheduled",
  [ScheduleStatus.RUNNING]: "Running",
  [ScheduleStatus.NO_WORKER]: "No Workers Found",
};

const verboseStatus = (status: ScheduleStatus) => {
  return verboseScheduleStatus[status];
};

getSchedulesCommand
  .description("Get all schedules")
  .option("-o, --output <type>", "output format")
  .action(async (options: { output?: string }) => {
    const authHeader = await getAuthHeader();
    const worker = await getWorker();
    const schedules = await worker.getSchedules(authHeader);
    printSchedules(schedules, options);
  });

function printSchedules(
  schedules: PublicJobSchedule[],
  options: { output?: string; single?: boolean }
) {
  if (options.output === "json") {
    if (options.single) {
      console.log(JSON.stringify(schedules[0], null, 2));
      return;
    }
    console.log(JSON.stringify(schedules, null, 2));
    return;
  }
  const head = ["ID", "Title", "Status", "Run at"];
  if (options.output === "wide") {
    head.splice(2, 0, "Description", "Handler");
  }
  const table = new Table({
    head,
    chars: {
      top: "",
      "top-mid": "",
      "top-left": "",
      "top-right": "",
      bottom: "",
      "bottom-mid": "",
      "bottom-left": "",
      "bottom-right": "",
      left: "",
      "left-mid": "",
      mid: "",
      "mid-mid": "",
      right: "",
      "right-mid": "",
      middle: " ",
    },
    style: { "padding-left": 0, "padding-right": 0 },
  });

  // Loop through your schedules and push rows to the table
  schedules.forEach((schedule) => {
    let time = "-";
    if (schedule.runAt) {
      const now = Date.now();
      const ra = schedule.runAt.getTime();
      const distance = ra - now;

      if (distance < 0) {
        time = `${getHumanTime(-distance)} ago`;
      } else {
        time = `in ${getHumanTime(distance)}`;
      }
    }
    const cols = [
      schedule.eventId ?? `db:${schedule.id}`,
      schedule.title,
      verboseStatus(schedule.status),
      time,
    ];
    if (options.output === "wide") {
      cols.splice(2, 0, schedule.description || "-", schedule.functionId);
    }

    table.push(cols);
  });
  console.table(table.toString());
}

// applyCommand
//   .description("Apply a schedule from a file or folder")
//   .requiredOption("-f, --file <type>", "file or folder to apply")
