import { test, expect } from "@playwright/test";

const URL =
  process.env.DASHBOARD_URL ||
  `http://${process.env.DASHBOARD_HOST || "localhost"}:${
    process.env.DASHBOARD_PORT
  }`;

test.describe("Feature: Listing of Runs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`${URL}/runs`);
  });

  test("Scenario: Seeing the runs table", async ({ page }) => {
    // Given I visit the Runs page
    // When I check for the table
    const runsTable = await page.waitForSelector("#runsTable"); // assuming the table has id 'runsTable'

    // Then I should see the table
    expect(runsTable).toBeTruthy();
  });
});

test.describe("Run Route", () => {
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

    const details = await page.waitForSelector('div#SchedulePage')

    // Then I should see the SchedulePage
    expect(details).toBeTruthy();
  });
});
