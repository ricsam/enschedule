import { test, expect } from "@playwright/test";

const URL =
  process.env.DASHBOARD_URL ||
  `http://${process.env.DASHBOARD_HOST || "localhost"}:${
    process.env.DASHBOARD_PORT
  }`;

test.describe("Single-Run", () => {
  test("Visit all pages that render the run", async ({ page }) => {
    // Given I visit the Runs page / runs
    await page.goto(`${URL}/runs`);
    expect(await page.waitForSelector("#RunsTable")).toBeTruthy();

    // Click on the first row and navigate to the RunPage /runs/$runId
    await page.getByTestId("table-row-1").getByTestId("run-link").click();
    expect(await page.waitForSelector("div#RunPage")).toBeTruthy();

    // Click on the schedules link /schedules/$scheduleId
    await page.getByTestId("schedule-link").click();
    expect(await page.waitForSelector("div#SchedulePage")).toBeTruthy();

    // Click on the runs tab to navigate to the RunsTable /schedules/$scheduleId/runs
    await page.getByRole('tab', { name: 'Runs' }).click();
    expect(await page.waitForSelector("div#RunsTable")).toBeTruthy();
    
    // Click on the first row and navigate to the RunPage /schedules/$scheduleId/runs/$runId
    await page.getByTestId("table-row-1").getByTestId("run-link").click();
    expect(await page.waitForSelector("div#RunPage")).toBeTruthy();

    // Click on the definitions link /definitions/$definitionId
    await page.getByTestId("definition-link").click();
    expect(await page.waitForSelector("div#DefinitionPage")).toBeTruthy();

    // Click on the schedules tab to navigate to the RunsTable /definitions/$definitionId/schedules
    await page.getByRole('tab', { name: 'Schedules' }).click();
    expect(await page.waitForSelector("div#SchedulesTable")).toBeTruthy();

    // Click on the first row and navigate to the SchedulePage /definitions/$definitionId/schedules/$scheduleId
    await page.getByTestId("table-row-1").getByTestId("schedule-link").click();
    expect(await page.waitForSelector("div#SchedulePage")).toBeTruthy();

    // Click on the runs tab to navigate to the RunsTable /definitions/$definitionId/schedules/$scheduleId/runs
    await page.getByRole('tab', { name: 'Runs' }).click();
    expect(await page.waitForSelector("div#RunsTable")).toBeTruthy();

    // Click on the first row and navigate to the RunPage /definitions/$definitionId/schedules/$scheduleId/runs/$runId
    await page.getByTestId("table-row-1").getByTestId("run-link").click();
    expect(await page.waitForSelector("div#RunPage")).toBeTruthy();
  });
});
