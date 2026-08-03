import { describe, expect, test } from "bun:test";
import type { DashboardWorker } from "./worker";
import { createDashboardRouter } from "./session-router";

describe("dashboard no-auth mode", () => {
  test("requires an API key", () => {
    expect(() => createDashboardRouter({} as DashboardWorker, { noAuth: true }))
      .toThrow("ENSCHEDULE_API_KEY is required when ENSCHEDULE_NO_AUTH is enabled");
  });

  test("opens dashboard routes with API-key-level access", async () => {
    let receivedHeader: string | undefined;
    const worker = {
      getWorkers: async (header: string) => {
        receivedHeader = header;
        return [];
      },
    } as unknown as DashboardWorker;
    const router = createDashboardRouter(worker, { noAuth: true, apiKey: "secret" });

    const session = await router.fetch(new Request("http://dashboard.test/api/session"));
    expect(session.status).toBe(200);
    expect(await session.json()).toEqual({ noAuth: true });

    const workers = await router.fetch(new Request("http://dashboard.test/api/workers"));
    expect(workers.status).toBe(200);
    expect(await workers.json()).toEqual([]);
    expect(receivedHeader).toBe("Api-Key secret");
  });

  test("keeps authentication enabled by default", async () => {
    const router = createDashboardRouter({} as DashboardWorker);
    const response = await router.fetch(new Request("http://dashboard.test/api/workers"));
    expect(response.status).toBe(401);
  });

  test("forwards auth to group operations", async () => {
    let receivedHeader: string | undefined;
    const worker = {
      getGroups: async (header: string) => {
        receivedHeader = header;
        return [];
      },
    } as unknown as DashboardWorker;
    const router = createDashboardRouter(worker, { noAuth: true, apiKey: "secret" });
    const response = await router.fetch(new Request("http://dashboard.test/api/groups"));
    expect(response.status).toBe(200);
    expect(receivedHeader).toBe("Api-Key secret");
  });
});
