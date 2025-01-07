import { getAuthHeader, getWorker } from "./get-worker";

export const getSchedule = async (scheduleId: string) => {
  const authHeader = await getAuthHeader();
  const worker = await getWorker();
  if (scheduleId.startsWith("db:")) {
    const dbId = scheduleId.substring(3);
    const schedule = await worker.getSchedule(authHeader, parseInt(dbId, 10));
    return schedule;
  }
  const schedules = await worker.getSchedules(authHeader, {
    eventId: scheduleId,
  });
  if (schedules.length === 0) {
    return;
  }
  return schedules[0];
};
