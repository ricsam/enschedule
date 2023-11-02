import { scheduler } from "~/scheduler.server";

export async function getLoaderData() {
  const definitions = await scheduler.getDefinitions();
  const schedules = await scheduler.getSchedules();
  return { definitions, schedules };
}
