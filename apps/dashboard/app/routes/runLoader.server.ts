import { getAuthHeader } from "~/sessions";
import type { DashboardWorker } from "~/types";

export async function getLoaderData(worker: DashboardWorker, request: Request) {
  const authHeader = await getAuthHeader(request);
  const definitions = await worker.getLatestHandlers(authHeader);
  const schedules = await worker.getSchedules();
  return { definitions, schedules };
}
