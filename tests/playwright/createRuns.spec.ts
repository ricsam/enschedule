import { test, expect } from "@playwright/test";

const URL =
  process.env.DASHBOARD_URL ||
  `http://${process.env.DASHBOARD_HOST || "localhost"}:${
    process.env.DASHBOARD_PORT
  }`;

test.describe("/run create a run", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${URL}/run`);
  });
  test("Should create a new run via chatbot", async ({ page }) => {
    // Select a job definition from the dropdown

    await page.getByTestId("definition-autocomplete").click();

    await page.keyboard.press("ArrowDown"); // Press the arrow down key
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

    const url = await link.getAttribute('href');

    if (!url) {
      throw new Error('invalid URL');
    }

    await page.goto(URL + url);

    await page.waitForURL('**/schedules/*');

    const details = await page.waitForSelector('div#SchedulePage');

    // Then I should see the SchedulePage
    expect(details).toBeTruthy();
  });
});
