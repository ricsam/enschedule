import { test, expect, Page } from "@playwright/test";
import { navigate, numRows } from "./utils";
import { baseURL } from "./url";

const visitRunPages = async (page: Page, numRuns = 4) => {
  const runPageUrls: string[] = [];

  const clickOnFirstRow = async () => {
    runPageUrls.push(
      await navigate(
        page,
        page.getByTestId("table-row-1").getByTestId("run-link")
      )
    );
  };

  // Given I visit the Runs page / runs
  await page.goto(`${baseURL}/runs`);
  expect(await page.waitForSelector("#RunsTable")).toBeTruthy();
  expect(await numRows(page)).toBe(numRuns);

  // Click on the first row and navigate to the RunPage /runs/$runId
  await clickOnFirstRow();
  expect(await page.waitForSelector("div#RunPage")).toBeTruthy();

  // Click on the schedules link /schedules/$scheduleId
  await navigate(page, page.getByTestId("schedule-link"));
  expect(await page.waitForSelector("div#SchedulePage")).toBeTruthy();

  // Click on the runs tab to navigate to the RunsTable /schedules/$scheduleId/runs
  await navigate(page, page.getByRole("tab", { name: "Runs" }));
  expect(await page.waitForSelector("div#RunsTable")).toBeTruthy();
  expect(await numRows(page)).toBe(1);

  // Click on the first row and navigate to the RunPage /schedules/$scheduleId/runs/$runId
  await clickOnFirstRow();
  expect(await page.waitForSelector("div#RunPage")).toBeTruthy();

  // Click on the definitions link /definitions/$definitionId
  await navigate(page, page.getByTestId("definition-link"));
  expect(await page.waitForSelector("div#DefinitionPage")).toBeTruthy();

  // Click on the schedules tab to navigate to the RunsTable /definitions/$definitionId/schedules
  await navigate(page, page.getByRole("tab", { name: "Schedules" }));
  expect(await page.waitForSelector("div#SchedulesTable")).toBeTruthy();

  // Click on the first row and navigate to the SchedulePage /definitions/$definitionId/schedules/$scheduleId
  await navigate(
    page,
    page.getByTestId("table-row-1").getByTestId("schedule-link")
  );
  expect(await page.waitForSelector("div#SchedulePage")).toBeTruthy();

  // Click on the runs tab to navigate to the RunsTable /definitions/$definitionId/schedules/$scheduleId/runs
  await navigate(page, page.getByRole("tab", { name: "Runs" }));
  expect(await page.waitForSelector("div#RunsTable")).toBeTruthy();
  expect(await numRows(page)).toBe(1);

  // Click on the first row and navigate to the RunPage /definitions/$definitionId/schedules/$scheduleId/runs/$runId
  await clickOnFirstRow();
  expect(await page.waitForSelector("div#RunPage")).toBeTruthy();

  return runPageUrls;
};

test.describe("Single-Run", () => {
  test("Visit all pages that render a run, and then delete all runs", async ({
    page,
  }) => {
    // test delete on each of these urls
    // /runs/$runId
    // /schedules/$scheduleId/runs/$runId
    // /definitions/$definitionId/schedules/$scheduleId/runs/$runId
    for (let i = 0; i < 3; i += 1) {
      await page.goto((await visitRunPages(page, 4 - i))[i]);
      await page.getByTestId("delete-run").click();
      expect(await page.waitForSelector("div#RunsTable")).toBeTruthy();
    }
  });
});
