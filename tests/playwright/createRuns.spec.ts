import { test, expect, Page } from "@playwright/test";
import { navigate } from "./navigate";
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
    for (let i = 1; i < 5; i += 1) {
      await createRun(page, i);
    }
  });
});
