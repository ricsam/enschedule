import type { DashboardWorker } from "~/types";

export async function getLoaderData(worker: DashboardWorker) {
  const definitions = await worker.getLatestHandlers();
  const schedules = await worker.getSchedules();
  return { definitions, schedules };
}
