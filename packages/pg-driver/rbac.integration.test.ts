import { afterAll, beforeAll, describe, expect, test } from "bun:test";
import { Worker } from "../worker/index";
import { z } from "zod";

const databaseUrl = process.env.RBAC_TEST_DATABASE_URL;
const describeDatabase = databaseUrl ? describe : describe.skip;
let worker: Worker;

const auth = (token: string) => `Jwt ${token}` as const;

describeDatabase("RBAC PostgreSQL integration", () => {
  beforeAll(async () => {
    process.env.DATABASE_URL = databaseUrl!;
    worker = new Worker({
      workerId: "rbac-integration",
      name: "RBAC integration",
      inlineWorker: true,
      database: { url: databaseUrl! },
      apiKey: "system",
      accessTokenSecret: "access-secret",
      refreshTokenSecret: "refresh-secret",
      nafsUri: "file:///tmp/enschedule-rbac-integration",
      access: { view: { groups: ["finance"] }, delete: { groups: ["finance"] } },
    });
    worker.registerJob({
      id: "finance-job",
      version: 1,
      title: "Finance job",
      dataSchema: z.object({}),
      access: { view: { groups: ["finance"] }, createSchedule: { groups: ["finance"] } },
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
      job: () => console.log("finance output"),
    });
    await worker.migrateDatabase();
    await worker.registerWorker();
  });

  afterAll(async () => worker?.close());

  test("group membership grants and revokes function and schedule access", async () => {
    const member = await worker.register({ username: "member", name: "Member", password: "password" });
    const outsider = await worker.register({ username: "outsider", name: "Outsider", password: "password" });
    const group = await worker.createGroup("Api-Key system", { key: "finance", title: "Finance", memberIds: [member.user.id] });
    const memberToken = (await worker.login("member", "password"))!.accessToken;
    const outsiderToken = (await worker.login("outsider", "password"))!.accessToken;

    expect(await worker.getLatestHandlers(auth(memberToken))).toHaveLength(1);
    expect(await worker.getLatestHandlers(auth(outsiderToken))).toHaveLength(0);
    const created = await worker.scheduleJob(auth(memberToken), "finance-job", 1, {}, { title: "Finance schedule" });
    expect(created.schedule.capabilities).toEqual({ view: true, edit: true, run: true, delete: true });
    expect(await worker.getSchedule(auth(outsiderToken), created.schedule.id)).toBeUndefined();

    await worker.updateGroup("Api-Key system", group.id, { memberIds: [] });
    expect(await worker.getLatestHandlers(auth(memberToken))).toHaveLength(0);
    expect(await worker.getSchedule(auth(memberToken), created.schedule.id)).toBeUndefined();
  });

  test("reports unresolved declaration keys", async () => {
    const diagnostics = await worker.getAccessDiagnostics("Api-Key system");
    expect(diagnostics).toEqual([]);
    await worker.deleteGroup("Api-Key system", (await worker.getGroups("Api-Key system"))[0]!.id);
    expect(await worker.getAccessDiagnostics("Api-Key system")).toContainEqual(expect.objectContaining({ key: "finance" }));
  });
});
