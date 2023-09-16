import { test, expect, Page } from "@playwright/test";
import { navigate, numRows } from "./utils";
import { Setup } from "./setup";

const setup = new Setup();

test.beforeEach(async () => {
  test.setTimeout(120 * 1000);
  await setup.setup();
});
test.afterEach(async () => {
  await setup.teardown();
});

const createRun = async (page: Page, definitionNumber: number) => {
  await page.goto(`${setup.dashboardUrl}/run`);

  // Select a job definition from the dropdown
  await page.getByTestId("definition-autocomplete").click();

  for (let i = 0; i < definitionNumber; i += 1) {
    await page.keyboard.press("ArrowDown"); // Press the arrow down key
  }
  await page.keyboard.press("Enter"); // Press the enter key
  await page.getByTestId("SendIcon").click();

  await page.getByTestId("run-now").click();

  // Type in title and description
  await page.getByTestId("title-input").fill("Test Title");
  await page.getByTestId("description-input").fill("Test Description");
  await page.getByTestId("SendIcon").click();

  // Click the send button next to the title and description
  await page.getByTestId("submit-button").click();

  const link = page.getByTestId("schedule-link");

  await navigate(setup.dashboardUrl, page, link);

  await page.waitForURL("**/schedules/*");

  const details = await page.waitForSelector("div#SchedulePage");

  // Then I should see the SchedulePage
  expect(details).toBeTruthy();
};

const visitRunPages = async (page: Page) => {
  const runPageUrls: string[] = [];
  const runsTableUrls: string[] = [];

  const clickOnFirstRow = async () => {
    runPageUrls.push(
      await navigate(
        setup.dashboardUrl,
        page,
        page.getByTestId("table-row-1").getByTestId("run-link")
      )
    );
  };

  // Given I visit the Runs page /runs
  runsTableUrls.push(`${setup.dashboardUrl}/runs`);
  await page.goto(`${setup.dashboardUrl}/runs`);
  expect(await page.waitForSelector("#RunsTable")).toBeTruthy();

  // Click on the first row and navigate to the RunPage /runs/$runId
  await clickOnFirstRow();
  expect(await page.waitForSelector("div#RunPage")).toBeTruthy();

  // Click on the schedules link /schedules/$scheduleId
  await navigate(setup.dashboardUrl, page, page.getByTestId("schedule-link"));
  expect(await page.waitForSelector("div#SchedulePage")).toBeTruthy();

  // Click on the runs tab to navigate to the RunsTable /schedules/$scheduleId/runs
  runsTableUrls.push(
    await navigate(
      setup.dashboardUrl,
      page,
      page.getByRole("tab", { name: "Runs" })
    )
  );
  expect(await page.waitForSelector("div#RunsTable")).toBeTruthy();

  // Click on the first row and navigate to the RunPage /schedules/$scheduleId/runs/$runId
  await clickOnFirstRow();
  expect(await page.waitForSelector("div#RunPage")).toBeTruthy();

  // Click on the definitions link /definitions/$definitionId
  await navigate(setup.dashboardUrl, page, page.getByTestId("definition-link"));
  expect(await page.waitForSelector("div#DefinitionPage")).toBeTruthy();

  // Click on the schedules tab to navigate to the RunsTable /definitions/$definitionId/schedules
  await navigate(
    setup.dashboardUrl,
    page,
    page.getByRole("tab", { name: "Schedules" })
  );
  expect(await page.waitForSelector("div#SchedulesTable")).toBeTruthy();

  // Click on the first row and navigate to the SchedulePage /definitions/$definitionId/schedules/$scheduleId
  await navigate(
    setup.dashboardUrl,
    page,
    page.getByTestId("table-row-1").getByTestId("schedule-link")
  );
  expect(await page.waitForSelector("div#SchedulePage")).toBeTruthy();

  // Click on the runs tab to navigate to the RunsTable /definitions/$definitionId/schedules/$scheduleId/runs
  runsTableUrls.push(
    await navigate(
      setup.dashboardUrl,
      page,
      page.getByRole("tab", { name: "Runs" })
    )
  );
  expect(await page.waitForSelector("div#RunsTable")).toBeTruthy();

  // Click on the first row and navigate to the RunPage /definitions/$definitionId/schedules/$scheduleId/runs/$runId
  await clickOnFirstRow();
  expect(await page.waitForSelector("div#RunPage")).toBeTruthy();

  return { runPageUrls, runsTableUrls };
};

const reset = async (page: Page) => {
  await page.goto(`${setup.dashboardUrl}/settings`);

  // reset enschedule
  await page.getByTestId("reset-enschedule").click();
  await page.getByTestId("confirm-reset-enschedule").click();

  // make sure tables are empty
  await page.goto(`${setup.dashboardUrl}/runs`);
  expect(await page.waitForSelector("#RunsTable")).toBeTruthy();
  expect(await numRows(page)).toBe(0);

  await page.goto(`${setup.dashboardUrl}/schedules`);
  expect(await page.waitForSelector("#SchedulesTable")).toBeTruthy();
  expect(await numRows(page)).toBe(0);
};

const waitForNumRuns = async (page: Page, num: number) => {
  // wait for all runs to be created
  await page.goto(`${setup.dashboardUrl}/runs`);

  const TIMEOUT = 20000;
  const RETRY_DURATION = 5000;
  if ((await numRows(page)) !== 4) {
    let i = 0;
    const maxIter = Math.floor(TIMEOUT / RETRY_DURATION);
    do {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, RETRY_DURATION);
      });
      await page.reload();
    } while ((await numRows(page)) !== 4 && i++ < maxIter);
    if (i >= maxIter) {
      throw new Error("Timed out waiting for the runs to show up in the table");
    }
  }
};

// test("a", async ({ page }) => {
//   await page.goto(setup.dashboardUrl);
// });
// test("b", async ({ page }) => {
//   await page.goto(setup.dashboardUrl);
// });

test.describe("Single-Run", () => {
  test("Should create new runs via chatbot, and then test the delete", async ({
    page,
  }) => {
    await reset(page);

    // create 4 runs + 4 schedules
    for (let i = 1; i < 5; i += 1) {
      await createRun(page, i);
    }

    await waitForNumRuns(page, 4);

    // There should be 4 runs / schedules in the tables
    await page.goto(`${setup.dashboardUrl}/runs`);
    expect(await page.waitForSelector("#RunsTable")).toBeTruthy();
    expect(await numRows(page)).toBe(4);

    await page.goto(`${setup.dashboardUrl}/schedules`);
    expect(await page.waitForSelector("#SchedulesTable")).toBeTruthy();
    expect(await numRows(page)).toBe(4);

    // test delete on each of these urls
    // /runs/$runId
    // /schedules/$scheduleId/runs/$runId
    // /definitions/$definitionId/schedules/$scheduleId/runs/$runId
    for (let i = 0; i < 3; i += 1) {
      const runPageVisit = await visitRunPages(page);

      await page.goto(runPageVisit.runsTableUrls[0]); // /runs
      expect(await page.waitForSelector("#RunsTable")).toBeTruthy();
      expect(await numRows(page)).toBe(4 - i);

      await page.goto(runPageVisit.runsTableUrls[1]); // /schedules/$scheduleId/runs
      expect(await page.waitForSelector("#RunsTable")).toBeTruthy();
      expect(await numRows(page)).toBe(1);

      await page.goto(runPageVisit.runsTableUrls[2]); // /definitions/$definitionId/schedules/$scheduleId/runs
      expect(await page.waitForSelector("#RunsTable")).toBeTruthy();
      expect(await numRows(page)).toBe(1);

      await page.goto(runPageVisit.runPageUrls[i]);
      await page.getByTestId("delete-run").click();
      expect(await page.waitForSelector("div#RunsTable")).toBeTruthy();
    }
  });
});

test.describe("Multi runs", () => {
  test("Test pagination", async ({ page }) => {
    await reset(page);
    for (let j = 0; j < 5; j += 1) {
      for (let i = 1; i < 5; i += 1) {
        await createRun(page, i);
      }
    }
    const { runsTableUrls } = await visitRunPages(page);

    await page.goto(runsTableUrls[0]); // /runs
    expect(await page.waitForSelector("#RunsTable")).toBeTruthy();
    expect(await numRows(page)).toBe(20);
  });
});
