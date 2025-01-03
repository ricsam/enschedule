import { BrowserContext, expect, Locator, Page } from "@playwright/test";
import * as cookieSignature from "cookie-signature";
import addDays from "date-fns/addDays";
import format from "date-fns/format";
import * as jwt from "jsonwebtoken";

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
  let innerText;

  try {
    innerText = await page.innerText(
      '[data-testid="pagination"] .MuiTablePagination-displayedRows'
    );
    return Number(innerText!.match(/ of (\d+)/)![1]);
  } catch (err) {
    throw new Error(
      "Failed to parse the pagination, can not read number of rows in the table, inner text is " +
        innerText
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
  baseUrl: { dashboardUrl: string; workerUrl?: string },
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
      data: unknown;
    };
  } = {}
) => {
  await page.goto(`${baseUrl.dashboardUrl}/run`);

  // Select a job definition from the dropdown
  await page.getByTestId("definition-autocomplete").click();

  for (let i = 0; i < definitionNumber; i += 1) {
    await page.keyboard.press("ArrowDown"); // Press the arrow down key
  }
  await page.keyboard.press("Enter"); // Press the enter key

  await page.getByTestId("no-specific-worker").click();

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
    await runAtField.focus();
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

  await navigate(baseUrl.dashboardUrl, page, link);

  await page.waitForURL("**/schedules/*");

  const details = await page.waitForSelector("div#SchedulePage");

  // Then I should see the SchedulePage
  expect(details).toBeTruthy();
};

const visitRunPages = async (
  baseUrl: { workerUrl?: string; dashboardUrl: string },
  page: Page
) => {
  const runPageUrls: string[] = [];
  const runsTableUrls: string[] = [];

  const clickOnFirstRow = async () => {
    runPageUrls.push(
      await navigate(
        baseUrl.dashboardUrl,
        page,
        page.getByTestId("table-row-1").getByTestId("run-link")
      )
    );
  };

  // Given I visit the Runs page /runs
  runsTableUrls.push(`${baseUrl.dashboardUrl}/runs`);
  await page.goto(`${baseUrl.dashboardUrl}/runs`);
  expect(await page.waitForSelector("#RunsTable")).toBeTruthy();

  // Click on the first row and navigate to the RunPage /runs/$runId
  await clickOnFirstRow();
  expect(await page.waitForSelector("div#RunPage")).toBeTruthy();

  // Click on the schedules link /schedules/$scheduleId
  await navigate(baseUrl.dashboardUrl, page, page.getByTestId("schedule-link"));
  expect(await page.waitForSelector("div#SchedulePage")).toBeTruthy();

  // Click on the runs tab to navigate to the RunsTable /schedules/$scheduleId/runs
  runsTableUrls.push(
    await navigate(
      baseUrl.dashboardUrl,
      page,
      page.getByRole("tab", { name: "Runs" })
    )
  );
  expect(await page.waitForSelector("div#RunsTable")).toBeTruthy();

  // Click on the first row and navigate to the RunPage /schedules/$scheduleId/runs/$runId
  await clickOnFirstRow();
  expect(await page.waitForSelector("div#RunPage")).toBeTruthy();

  // Click on the definitions link /definitions/$functionId
  await navigate(
    baseUrl.dashboardUrl,
    page,
    page.getByTestId("definition-link")
  );
  expect(await page.waitForSelector("div#DefinitionPage")).toBeTruthy();

  // Click on the schedules tab to navigate to the RunsTable /definitions/$functionId/schedules
  await navigate(
    baseUrl.dashboardUrl,
    page,
    page.getByRole("tab", { name: "Schedules" })
  );
  expect(await page.waitForSelector("div#SchedulesTable")).toBeTruthy();

  // Click on the first row and navigate to the SchedulePage /definitions/$functionId/schedules/$scheduleId
  await navigate(
    baseUrl.dashboardUrl,
    page,
    page.getByTestId("table-row-1").getByTestId("schedule-link")
  );
  expect(await page.waitForSelector("div#SchedulePage")).toBeTruthy();

  // Click on the runs tab to navigate to the RunsTable /definitions/$functionId/schedules/$scheduleId/runs
  runsTableUrls.push(
    await navigate(
      baseUrl.dashboardUrl,
      page,
      page.getByRole("tab", { name: "Runs" })
    )
  );
  expect(await page.waitForSelector("div#RunsTable")).toBeTruthy();

  // Click on the first row and navigate to the RunPage /definitions/$functionId/schedules/$scheduleId/runs/$runId
  await clickOnFirstRow();
  expect(await page.waitForSelector("div#RunPage")).toBeTruthy();

  return { runPageUrls, runsTableUrls };
};

const reset = async (
  baseUrl: { dashboardUrl: string; workerUrl?: string },
  page: Page
) => {
  if (baseUrl.workerUrl) {
    await fetch(
      `${baseUrl.workerUrl}/test/set-poll-interval?pollInterval=${1}`
    );
  }

  await login(baseUrl, page);

  await page.goto(`${baseUrl.dashboardUrl}/admin`);

  // reset enschedule
  await page.getByTestId("reset-enschedule").click();
  await page.getByTestId("confirm-reset-enschedule").click();

  // make sure tables are empty
  await page.goto(`${baseUrl.dashboardUrl}/runs`);
  expect(await page.waitForSelector("#RunsTable")).toBeTruthy();
  expect(await numRows(page)).toBe(0);

  await page.goto(`${baseUrl.dashboardUrl}/schedules`);
  expect(await page.waitForSelector("#SchedulesTable")).toBeTruthy();
  expect(await numRows(page)).toBe(0);
};

export const waitForNumRows = async (
  page: Page,
  num: number,
  status?: string
) => {
  const TIMEOUT = 40000;
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
    } while (
      ((await numRows(page)) !== num ||
        (status && !(await allRowsHasStatus(page, status)))) &&
      i++ < maxIter
    );
    if (i >= maxIter) {
      throw new Error("Timed out waiting for the runs to show up in the table");
    }
  }
};

async function allRowsHasStatus(page: Page, status: string) {
  return page.evaluate(
    ([status]) => {
      return [
        ...document.querySelectorAll('.table-row [data-testid="status"]'),
      ].every((node) => (node as HTMLElement).dataset.status === status);
    },
    [status]
  );
}

type ArgType<T> = T extends (
  baseUrl: { dashboardUrl: string; workerUrl?: string },
  ...args: infer U
) => any
  ? U
  : never;

export const utils = (baseUrl: {
  dashboardUrl: string;
  workerUrl?: string;
}) => {
  return {
    createRun: (...args: ArgType<typeof createRun>) =>
      createRun(baseUrl, ...args),
    visitRunPages: (...args: ArgType<typeof visitRunPages>) =>
      visitRunPages(baseUrl, ...args),
    reset: (...args: ArgType<typeof reset>) => reset(baseUrl, ...args),
    login: (...args: ArgType<typeof login>) => login(baseUrl, ...args),
    addLoginCookie: (...args: ArgType<typeof addLoginCookie>) =>
      addLoginCookie(baseUrl, ...args),
  };
};

async function login(
  baseUrl: { workerUrl?: string; dashboardUrl: string },
  page: Page
) {
  await page.goto(`${baseUrl.dashboardUrl}/`);
  await page.waitForSelector('[data-testid="enschedule-logo"]');
  if (await page.isVisible('[data-testid="login-link"]')) {
    await page.click('[data-testid="login-link"]');
    await page.waitForURL(/\/login/);
    await page.getByLabel("Username").fill("adm1n");
    await page.getByLabel("Password").fill("s3cr3t");
    await page.click('#login-form [type="submit"]');
    await page.waitForURL(baseUrl.dashboardUrl);
    await page.waitForSelector('[data-testid="profile-link"]');
  } else if (await page.isVisible('[data-testid="profile-link"]')) {
    // Already logged in
    console.log("Already loggged in");
  } else {
    throw new Error("Failed to login");
  }
}
export async function addLoginCookie(
  baseUrl: { workerUrl?: string; dashboardUrl: string },
  context: BrowserContext,
  expire: string
) {
  // Replicate the cookie process in remix. This may change in the future!
  const token = jwt.sign({ userId: 1, admin: true }, "secret_key", {
    expiresIn: expire,
  });
  await context.addCookies([
    {
      name: "access_token",
      value: cookieSignature.sign(
        btoa(myUnescape(encodeURIComponent(JSON.stringify({ token })))),
        "s3cr3t"
      ),
      httpOnly: true,
      sameSite: "Lax",
      url: baseUrl.dashboardUrl,
      secure: false,
    },
  ]);
}

// https://github.com/remix-run/remix/blob/aabc7f84514c1c0e0ba8e33c48c7fba422cf8084/packages/remix-server-runtime/cookies.ts#L222C1-L250C2
// See: https://github.com/zloirock/core-js/blob/master/packages/core-js/modules/es.unescape.js
function myUnescape(value: string): string {
  let str = value.toString();
  let result = "";
  let index = 0;
  let chr, part;
  while (index < str.length) {
    chr = str.charAt(index++);
    if (chr === "%") {
      if (str.charAt(index) === "u") {
        part = str.slice(index + 1, index + 5);
        if (/^[\da-f]{4}$/i.exec(part)) {
          result += String.fromCharCode(parseInt(part, 16));
          index += 5;
          continue;
        }
      } else {
        part = str.slice(index, index + 2);
        if (/^[\da-f]{2}$/i.exec(part)) {
          result += String.fromCharCode(parseInt(part, 16));
          index += 2;
          continue;
        }
      }
    }
    result += chr;
  }
  return result;
}
