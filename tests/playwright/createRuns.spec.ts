import { test, expect, Page } from "@playwright/test";
import { navigate, numRows } from "./utils";
import { baseURL } from "./url";

const createRun = async (page: Page, definitionNumber: number) => {
  await page.goto(`${baseURL}/run`);

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

  await navigate(page, link);

  await page.waitForURL("**/schedules/*");

  const details = await page.waitForSelector("div#SchedulePage");

  // Then I should see the SchedulePage
  expect(details).toBeTruthy();
};

test.describe("/run create a run", () => {
  test("Should create new runs via chatbot", async ({ page }) => {
    await page.goto(`${baseURL}/settings`);

    // reset enschedule
    await page.getByTestId("reset-enschedule").click();
    await page.getByTestId("confirm-reset-enschedule").click();

    // make sure tables are empty
    await page.goto(`${baseURL}/runs`);
    expect(await page.waitForSelector("#RunsTable")).toBeTruthy();
    expect(await numRows(page)).toBe(0);

    await page.goto(`${baseURL}/schedules`);
    expect(await page.waitForSelector("#SchedulesTable")).toBeTruthy();
    expect(await numRows(page)).toBe(0);

    // create 4 runs + 4 schedules
    for (let i = 1; i < 5; i += 1) {
      await createRun(page, i);
    }

    // wait for all runs to be created
    await page.goto(`${baseURL}/runs`);

    if ((await numRows(page)) !== 4) {
      let i = 0;
      do {
        await new Promise<void>((resolve) => {
          setTimeout(() => {
            resolve();
          }, 5000);
        });
        await page.reload();
      } while ((await numRows(page)) !== 4 && i++ < 4);
      if (i >= 4) {
        throw new Error('Timed out waiting for the runs to show up in the table')
      }
    }

    // There should be 4 runs / schedules in the tables
    expect(await page.waitForSelector("#RunsTable")).toBeTruthy();
    expect(await numRows(page)).toBe(4);

    await page.goto(`${baseURL}/schedules`);
    expect(await page.waitForSelector("#SchedulesTable")).toBeTruthy();
    expect(await numRows(page)).toBe(4);
  });
});
