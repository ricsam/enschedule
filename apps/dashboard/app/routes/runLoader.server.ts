import type { DashboardWorker } from "~/types";

export async function getLoaderData(worker: DashboardWorker) {
  const definitions = await worker.getDefinitions();
  const schedules = await worker.getSchedules();
  return { definitions, schedules };
}
