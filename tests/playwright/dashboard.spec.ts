import { test, expect } from "@playwright/test";
import { navigate } from "./navigate";
import { baseURL } from "./url";

test.describe("Single-Run", () => {
  test("Visit all pages that render the run", async ({ page }) => {
    // Given I visit the Runs page / runs
    await page.goto(`${baseURL}/runs`);
    expect(await page.waitForSelector("#RunsTable")).toBeTruthy();

    // Click on the first row and navigate to the RunPage /runs/$runId
    await navigate(
      page,
      page.getByTestId("table-row-1").getByTestId("run-link")
    );
    expect(await page.waitForSelector("div#RunPage")).toBeTruthy();

    // Click on the schedules link /schedules/$scheduleId
    await navigate(page, page.getByTestId("schedule-link"));
    expect(await page.waitForSelector("div#SchedulePage")).toBeTruthy();

    // Click on the runs tab to navigate to the RunsTable /schedules/$scheduleId/runs
    await navigate(page, page.getByRole("tab", { name: "Runs" }));
    expect(await page.waitForSelector("div#RunsTable")).toBeTruthy();

    // Click on the first row and navigate to the RunPage /schedules/$scheduleId/runs/$runId
    await navigate(
      page,
      page.getByTestId("table-row-1").getByTestId("run-link")
    );
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

    // Click on the first row and navigate to the RunPage /definitions/$definitionId/schedules/$scheduleId/runs/$runId
    await navigate(
      page,
      page.getByTestId("table-row-1").getByTestId("run-link")
    );
    expect(await page.waitForSelector("div#RunPage")).toBeTruthy();
  });
});
