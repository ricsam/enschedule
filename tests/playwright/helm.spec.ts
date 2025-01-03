import { expect, test } from "@playwright/test";
import { numRows, utils, waitForNumRows } from "./utils";

export const dashboardUrl = process.env.DASHBOARD_URL;
if (!dashboardUrl) {
  throw new Error(
    "You must provide the DASHBOARD_URL env pointing to the url of the deployed helm chart"
  );
}
export const workerUrl = process.env.WORKER_URL;

test.describe.configure({ mode: "serial" });

const { reset, createRun, visitRunPages, login, addLoginCookie } = utils({
  get dashboardUrl() {
    return dashboardUrl;
  },
  get workerUrl() {
    return workerUrl;
  },
});

test.describe("Single-Run", () => {
  test("Should create new runs via chatbot", async ({ page }) => {
    await reset(page);
    await login(page);

    // create 2 runs + 2 schedules
    const defs = [
      {
        definitionNumber: 1,
        data: {
          globalEditorRefName: "schedule-data-editor",
          data: `{"url": "http://simple-http-server:3000"}`,
        },
      },
      {
        definitionNumber: 2,
      },
    ];
    for (let i = 0; i < defs.length; i += 1) {
      const def = defs[i];
      await createRun(page, def.definitionNumber, {
        data: def.data ? def.data : undefined,
      });
    }

    await page.goto(`${dashboardUrl}/runs`);
    await waitForNumRows(page, 2);

    // There should be 4 runs / schedules in the tables
    await page.goto(`${dashboardUrl}/runs`);
    expect(await page.waitForSelector("#RunsTable")).toBeTruthy();
    expect(await numRows(page)).toBe(2);

    await page.goto(`${dashboardUrl}/schedules`);
    expect(await page.waitForSelector("#SchedulesTable")).toBeTruthy();
    expect(await numRows(page)).toBe(2);
  });
  test("Visit all pages that render a run, and then delete all runs", async ({
    page,
  }) => {
    await login(page);
    // test delete on each of these urls
    // /runs/$runId
    // /schedules/$scheduleId/runs/$runId
    // /definitions/$functionId/schedules/$scheduleId/runs/$runId
    const runPageVisit = await visitRunPages(page);

    await page.goto(runPageVisit.runsTableUrls[0]); // /runs
    expect(await page.waitForSelector("#RunsTable")).toBeTruthy();
    expect(await numRows(page)).toBe(2);

    await page.goto(runPageVisit.runsTableUrls[1]); // /schedules/$scheduleId/runs
    expect(await page.waitForSelector("#RunsTable")).toBeTruthy();
    expect(await numRows(page)).toBe(1);

    await page.goto(runPageVisit.runsTableUrls[2]); // /definitions/$functionId/schedules/$scheduleId/runs
    expect(await page.waitForSelector("#RunsTable")).toBeTruthy();
    expect(await numRows(page)).toBe(1);

    await page.goto(runPageVisit.runPageUrls[0]);
    await page.getByTestId("delete-run").click();
    expect(await page.waitForSelector("div#RunsTable")).toBeTruthy();
  });
});
