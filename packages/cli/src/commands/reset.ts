import { Command } from "commander";
import inquirer from "inquirer";
import { getAuthHeader, getWorker } from "../get-worker";
import { deleteCommand, deleteScheduleCommand } from "./delete";

export const resetCommand = new Command("reset");

resetCommand
  .description("Reset enschedule by deleting all schedules")
  .option("-f, --force", "Force reset without confirmation prompt")
  .action(async (options) => {
    const { force } = options;

    if (!force) {
      const { confirmed } = await inquirer.prompt([
        {
          type: "confirm",
          name: "confirmed",
          message:
            "Are you sure you want to reset enschedule? This will delete everything in the database.",
          default: false,
        },
      ]);

      if (!confirmed) {
        console.log("Reset cancelled");
        return;
      }
    }

    try {
      const authHeader = await getAuthHeader();
      const worker = await getWorker();
      await worker.reset(authHeader);
      console.log("Successfully reset enschedule");
    } catch (error) {
      console.error("Failed to reset enschedule:", error);
      process.exit(1);
    }
  });
