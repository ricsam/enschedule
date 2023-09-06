import { test, expect } from "@playwright/test";

test.describe("Feature: Listing of Runs", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`http://localhost:${process.env.DASHBOARD_PORT}/runs`);
  });

  test("Scenario: Seeing the runs table", async ({ page }) => {
    // Given I visit the Runs page
    // When I check for the table
    const runsTable = await page.$("#runsTable"); // assuming the table has id 'runsTable'

    // Then I should see the table
    expect(runsTable).toBeTruthy();
  });
});

test.describe("Run Route", () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(`http://localhost:${process.env.DASHBOARD_PORT}/run`);
  });
  test("Should create a new run via chatbot", async ({ page }) => {
    // Select a job definition from the dropdown

    await page.getByTestId("definition-autocomplete").click();

    await page.keyboard.type("Send HTTP request"); // Type the name of the job definition to select
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

    await page.getByTestId("schedule-link").click();

    let runId = 1;
    await page.goto(
      `http://localhost:${process.env.DASHBOARD_PORT}/runs/${runId}`
    );

    // When I check for the details section
    const detailsSection = await page.$("div#runDetailsSection"); // assuming the section has id 'runDetailsSection'

    // Then I should see the details section
    expect(detailsSection).toBeTruthy();
  });
});
