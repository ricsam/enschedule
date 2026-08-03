// Manual clean-database smoke test used during development.
import { Worker } from "../worker/index";
import { z } from "zod";

const worker = new Worker({
  workerId: "rbac-smoke",
  name: "RBAC smoke",
  inlineWorker: true,
  apiKey: "system",
  access: { view: { groups: ["finance"] }, delete: { groups: ["finance"] } },
  accessTokenSecret: process.env.ENSCHEDULE_ACCESS_TOKEN_SECRET!,
  refreshTokenSecret: process.env.ENSCHEDULE_REFRESH_TOKEN_SECRET!,
  nafsUri: process.env.NAFS_URI!,
});
worker.registerJob({
  id: "finance-job",
  version: 1,
  title: "Finance",
  dataSchema: z.object({}),
  access: {
    view: { groups: ["finance"] },
    createSchedule: { groups: ["finance"] },
  },
  defaultScheduleAccess: {
    view: { groups: ["finance"] },
    edit: { groups: ["finance"] },
    run: { groups: ["finance"] },
    delete: { groups: ["finance"] },
  },
  defaultRunAccess: {
    view: { groups: ["finance"] },
    viewLogs: { groups: ["finance"] },
    delete: { groups: ["finance"] },
  },
  job: () => console.log("ok"),
});
await worker.migrateDatabase();
await worker.registerWorker();
const registration = await worker.register({ username: "member", name: "Member", password: "password" });
const group = await worker.createGroup("Api-Key system", { key: "finance", title: "Finance", memberIds: [registration.user.id] });
const login = await worker.login("member", "password");
const auth = `Jwt ${login!.accessToken}` as const;
if ((await worker.getLatestHandlers(auth)).length !== 1) throw new Error("function grant failed");
const created = await worker.scheduleJob(auth, "finance-job", 1, {}, { title: "Finance run", runNow: false });
if (!created.schedule.capabilities.run) throw new Error("schedule capability failed");
await worker.runScheduleNow(auth, created.schedule.id);
const outsider = await worker.register({ username: "outsider", name: "Outsider", password: "password" });
const outsiderAuth = `Jwt ${outsider.access!.accessToken}` as const;
if ((await worker.getSchedules(outsiderAuth)).length !== 0) throw new Error("schedule filtering failed");
const diagnostics = await worker.getAccessDiagnostics("Api-Key system");
if (diagnostics.length) throw new Error("unexpected diagnostics");
console.log(JSON.stringify({ group: group.key, functionCount: (await worker.getLatestHandlers(auth)).length, scheduleId: created.schedule.id }));
await worker.close();
