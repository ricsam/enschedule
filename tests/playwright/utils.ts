import { expect, Locator, Page } from "@playwright/test";
import addDays from "date-fns/addDays";
import format from "date-fns/format";

export const navigate = async (baseUrl: string, page: Page, link: Locator) => {
  const url = await link.getAttribute("href");

  if (!url) {
    throw new Error("invalid URL");
  }

  const fullUrl = baseUrl + url;

  await page.goto(fullUrl);

  return fullUrl;
};

export async function numRows(page: Page) {
  try {
    const innerText = await (
      await page.$(
        '[data-testid="pagination"] .MuiTablePagination-displayedRows'
      )
    )?.innerText();
    return Number(innerText!.match(/ of (\d+)/)![1]);
  } catch (err) {
    throw new Error(
      "Failed to parse the pagination, can not read number of rows in the table"
    );
  }
}

export const sleep = async (ms: number) => {
  await new Promise<void>((resolve) => {
    setTimeout(() => {
      resolve();
    }, ms);
  });
};

const createRun = async (
  baseUrl: () => string,
  page: Page,
  definitionNumber: number,
  options: {
    runTomorrow?: boolean;
    retry?: boolean;
    maxRetry?: number;
    trigger?: boolean;
    manual?: boolean;
    data?: {
      globalEditorRefName: string;
      data: unknown
    };
  } = {}
) => {
  await page.goto(`${baseUrl()}/run`);

  // Select a job definition from the dropdown
  await page.getByTestId("definition-autocomplete").click();

  for (let i = 0; i < definitionNumber; i += 1) {
    await page.keyboard.press("ArrowDown"); // Press the arrow down key
  }
  await page.keyboard.press("Enter"); // Press the enter key

  if (options.data) {
    const ref = `window['${options.data.globalEditorRefName}']`;
    await page.waitForFunction(`!!${ref}`);
    await page.evaluate(`${ref}.setValue(\`${options.data.data}\`)`);
  }

  await page.getByTestId("SendIcon").click();

  if (!options?.runTomorrow) {
    if (options.manual) {
      await page.getByTestId("run-manual").click();
    } else {
      await page.getByTestId("run-now").click();
    }
  } else {
    await page.getByTestId("run-later").click();
    await page.getByTestId("repeat-no").click();

    const runAtField = page.getByTestId("runAt-input");
    await runAtField.clear();

    const tomorrow = addDays(new Date(), 1);

    const now = format(tomorrow, "yyyy-MM-dd'T'HH:mm:ss");
    await runAtField.fill(now);

    await page.getByTestId("submit-runAt").click();
  }

  // Type in title and description
  await page.getByTestId("title-input").fill("Test Title");
  await page.getByTestId("description-input").fill("Test Description");
  await page.getByTestId("SendIcon").click();

  if (options.retry) {
    await page.getByTestId("retry-yes").click();
    await page
      .getByTestId("max-retries-input")
      .fill(options.maxRetry ? String(options.maxRetry) : "1");
    await page.getByTestId("submit-max-retries").click();
  } else {
    await page.getByTestId("retry-no").click();
  }

  if (options.maxRetry !== -1) {
    if (options.trigger) {
      await page.getByTestId("trigger-yes").click();
      await page.pause();
      await page.getByTestId("schedule-autocomplete").click();
      await page.keyboard.press("ArrowDown"); // Press the arrow down key
      await page.keyboard.press("Enter"); // Press the enter key
    } else {
      await page.getByTestId("trigger-no").click();
    }
  }

  // Click the send button next to the title and description
  await page.getByTestId("submit-button").click();

  const link = page.getByTestId("schedule-link");

  await navigate(baseUrl(), page, link);

  await page.waitForURL("**/schedules/*");

  const details = await page.waitForSelector("div#SchedulePage");

  // Then I should see the SchedulePage
  expect(details).toBeTruthy();
};

const visitRunPages = async (baseUrl: () => string, page: Page) => {
  const runPageUrls: string[] = [];
  const runsTableUrls: string[] = [];

  const clickOnFirstRow = async () => {
    runPageUrls.push(
      await navigate(
        baseUrl(),
        page,
        page.getByTestId("table-row-1").getByTestId("run-link")
      )
    );
  };

  // Given I visit the Runs page /runs
  runsTableUrls.push(`${baseUrl()}/runs`);
  await page.goto(`${baseUrl()}/runs`);
  expect(await page.waitForSelector("#RunsTable")).toBeTruthy();

  // Click on the first row and navigate to the RunPage /runs/$runId
  await clickOnFirstRow();
  expect(await page.waitForSelector("div#RunPage")).toBeTruthy();

  // Click on the schedules link /schedules/$scheduleId
  await navigate(baseUrl(), page, page.getByTestId("schedule-link"));
  expect(await page.waitForSelector("div#SchedulePage")).toBeTruthy();

  // Click on the runs tab to navigate to the RunsTable /schedules/$scheduleId/runs
  runsTableUrls.push(
    await navigate(baseUrl(), page, page.getByRole("tab", { name: "Runs" }))
  );
  expect(await page.waitForSelector("div#RunsTable")).toBeTruthy();

  // Click on the first row and navigate to the RunPage /schedules/$scheduleId/runs/$runId
  await clickOnFirstRow();
  expect(await page.waitForSelector("div#RunPage")).toBeTruthy();

  // Click on the definitions link /definitions/$handlerId
  await navigate(baseUrl(), page, page.getByTestId("definition-link"));
  expect(await page.waitForSelector("div#DefinitionPage")).toBeTruthy();

  // Click on the schedules tab to navigate to the RunsTable /definitions/$handlerId/schedules
  await navigate(baseUrl(), page, page.getByRole("tab", { name: "Schedules" }));
  expect(await page.waitForSelector("div#SchedulesTable")).toBeTruthy();

  // Click on the first row and navigate to the SchedulePage /definitions/$handlerId/schedules/$scheduleId
  await navigate(
    baseUrl(),
    page,
    page.getByTestId("table-row-1").getByTestId("schedule-link")
  );
  expect(await page.waitForSelector("div#SchedulePage")).toBeTruthy();

  // Click on the runs tab to navigate to the RunsTable /definitions/$handlerId/schedules/$scheduleId/runs
  runsTableUrls.push(
    await navigate(baseUrl(), page, page.getByRole("tab", { name: "Runs" }))
  );
  expect(await page.waitForSelector("div#RunsTable")).toBeTruthy();

  // Click on the first row and navigate to the RunPage /definitions/$handlerId/schedules/$scheduleId/runs/$runId
  await clickOnFirstRow();
  expect(await page.waitForSelector("div#RunPage")).toBeTruthy();

  return { runPageUrls, runsTableUrls };
};

const reset = async (baseUrl: () => string, page: Page) => {
  await page.goto(`${baseUrl()}/settings`);

  // reset enschedule
  await page.getByTestId("reset-enschedule").click();
  await page.getByTestId("confirm-reset-enschedule").click();

  // make sure tables are empty
  await page.goto(`${baseUrl()}/runs`);
  expect(await page.waitForSelector("#RunsTable")).toBeTruthy();
  expect(await numRows(page)).toBe(0);

  await page.goto(`${baseUrl()}/schedules`);
  expect(await page.waitForSelector("#SchedulesTable")).toBeTruthy();
  expect(await numRows(page)).toBe(0);
};

export const waitForNumRows = async (page: Page, num: number) => {
  const TIMEOUT = 20000;
  const RETRY_DURATION = 5000;
  if ((await numRows(page)) !== num) {
    let i = 0;
    const maxIter = Math.floor(TIMEOUT / RETRY_DURATION);
    do {
      await new Promise<void>((resolve) => {
        setTimeout(() => {
          resolve();
        }, RETRY_DURATION);
      });
      await page.reload();
    } while ((await numRows(page)) !== num && i++ < maxIter);
    if (i >= maxIter) {
      throw new Error("Timed out waiting for the runs to show up in the table");
    }
  }
};

type ArgType<T> = T extends (baseUrl: () => string, ...args: infer U) => any
  ? U
  : never;

export const utils = (baseUrl: () => string) => {
  return {
    createRun: (...args: ArgType<typeof createRun>) =>
      createRun(baseUrl, ...args),
    visitRunPages: (...args: ArgType<typeof visitRunPages>) =>
      visitRunPages(baseUrl, ...args),
    reset: (...args: ArgType<typeof reset>) => reset(baseUrl, ...args),
  };
};
