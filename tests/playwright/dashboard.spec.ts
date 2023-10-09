import { test, expect, Page } from "@playwright/test";
import { navigate, numRows, sleep } from "./utils";
import { Setup } from "./setup";
import format from "date-fns/format";
import addDays from "date-fns/addDays";

const setup = new Setup();

test.beforeEach(async () => {
  test.setTimeout(120 * 1000);
  await setup.setup();
});
test.afterEach(async () => {
  await setup.teardown();
});

const createRun = async (
  page: Page,
  definitionNumber: number,
  options?: {
    runTomorrow?: boolean;
  }
) => {
  await page.goto(`${setup.dashboardUrl}/run`);

  // Select a job definition from the dropdown
  await page.getByTestId("definition-autocomplete").click();

  for (let i = 0; i < definitionNumber; i += 1) {
    await page.keyboard.press("ArrowDown"); // Press the arrow down key
  }
  await page.keyboard.press("Enter"); // Press the enter key
  await page.getByTestId("SendIcon").click();

  if (!options?.runTomorrow) {
    await page.getByTestId("run-now").click();
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

const waitForNumRows = async (page: Page, num: number) => {
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

test.describe("Single-Run", () => {
  test("Should create new runs via chatbot, and then test the delete", async ({
    page,
  }) => {
    await reset(page);

    // create 4 runs + 4 schedules
    for (let i = 1; i < 5; i += 1) {
      await createRun(page, i);
    }

    await page.goto(`${setup.dashboardUrl}/runs`);
    await waitForNumRows(page, 4);

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
    test.slow();
    await reset(page);
    for (let j = 0; j < 11; j += 1) {
      await createRun(page, (j % 4) + 1);
    }
    const { runsTableUrls } = await visitRunPages(page);

    await page.goto(runsTableUrls[0]); // /runs
    expect(await page.waitForSelector("#RunsTable")).toBeTruthy();
    await waitForNumRows(page, 11);
    expect(await numRows(page)).toBe(11);

    const getPaginationText = async () => {
      const innerText = await (
        await page.$(
          '[data-testid="pagination"] .MuiTablePagination-displayedRows'
        )
      )?.innerText();
      return innerText;
    };
    expect(await getPaginationText()).toBe("1–11 of 11");

    await page.getByTestId("pagination").getByLabel("25").click();
    await page.getByRole("option", { name: "10", exact: true }).click();

    await page.waitForURL(/rowsPerPage=10/);

    await page.waitForSelector('[data-rows-per-page="10"]');

    expect(await getPaginationText()).toBe("1–10 of 11");
    await page
      .getByTestId("pagination")
      .getByTestId("KeyboardArrowRightIcon")
      .click();
    expect(await getPaginationText()).toBe("11–11 of 11");

    await page.getByTestId("table-row-1").getByRole("checkbox").click();
    await page.getByTestId("ms-delete").click();
    await waitForNumRows(page, 10);
    expect(await getPaginationText()).toBe("1–10 of 10");

    await page.getByTestId("table-row-2").getByRole("checkbox").click();
    await page.getByTestId("table-row-3").getByRole("checkbox").click();
    await page.getByTestId("ms-delete").click();
    await waitForNumRows(page, 8);
    expect(await numRows(page)).toBe(8);
  });
  test("Test multi delete on schedules", async ({ page }) => {
    await reset(page);
    await createRun(page, 1);

    await page.goto(`${setup.dashboardUrl}/schedules`);
    await navigate(
      setup.dashboardUrl,
      page,
      page.getByTestId("table-row-1").getByTestId("schedule-link")
    );
    await navigate(
      setup.dashboardUrl,
      page,
      page.getByRole("tab", { name: "Runs" })
    );
    await waitForNumRows(page, 1);

    await page.getByTestId("table-row-1").getByRole("checkbox").click();
    await page.getByTestId("ms-delete").click();
    await waitForNumRows(page, 0);
    expect(await numRows(page)).toBe(0);
  });
  test("Test multi delete on definitions", async ({ page }) => {
    await reset(page);
    await createRun(page, 1);

    await page.goto(`${setup.dashboardUrl}/definitions`);
    await navigate(
      setup.dashboardUrl,
      page,
      page.getByTestId("table-row-1").getByTestId("definition-link")
    );
    await navigate(
      setup.dashboardUrl,
      page,
      page.getByRole("tab", { name: "Schedules" })
    );
    await navigate(
      setup.dashboardUrl,
      page,
      page.getByTestId("table-row-1").getByTestId("schedule-link")
    );
    await navigate(
      setup.dashboardUrl,
      page,
      page.getByRole("tab", { name: "Runs" })
    );
    await waitForNumRows(page, 1);

    await page.getByTestId("table-row-1").getByRole("checkbox").click();
    await page.getByTestId("ms-delete").click();
    await waitForNumRows(page, 0);
    expect(await numRows(page)).toBe(0);
  });
});

test.describe("Single schedule", () => {
  test("Can create multiple runs (run now button) on a schedule, and filtering on runs work", async ({
    page,
  }) => {
    test.slow();
    await reset(page);
    const createRuns = async (scheduleNum: number) => {
      await createRun(page, 1);
      await page.goto(`${setup.dashboardUrl}/schedules`);
      await navigate(
        setup.dashboardUrl,
        page,
        page
          .getByTestId("table-row-" + scheduleNum)
          .getByTestId("schedule-link")
      );
      await navigate(
        setup.dashboardUrl,
        page,
        page.getByRole("tab", { name: "Runs" })
      );

      // run now works
      let numRuns = 1;
      await waitForNumRows(page, numRuns);

      const run = async () => {
        numRuns += 1;
        await page.getByTestId("run-now").click();
        await page.getByTestId("run-now-snackbar").isVisible();
        await waitForNumRows(page, numRuns);
        expect(await numRows(page)).toBe(numRuns);
      };

      await run();
      await run();
      await run();
    };
    await createRuns(1);
    await createRuns(2);
    await page.goto(`${setup.dashboardUrl}/runs`);
    // main runs page should have 8 runs
    await waitForNumRows(page, 8);
    expect(await numRows(page)).toBe(8);
    await navigate(
      setup.dashboardUrl,
      page,
      page.getByTestId("table-row-1").getByTestId("run-link")
    );
    // also check that the runs page under the definitions hierarchy works
    await page.getByTestId("definition-link").click();
    await navigate(
      setup.dashboardUrl,
      page,
      page.getByRole("tab", { name: "Schedules" })
    );
    await navigate(
      setup.dashboardUrl,
      page,
      page.getByTestId("table-row-1").getByTestId("schedule-link")
    );
    await navigate(
      setup.dashboardUrl,
      page,
      page.getByRole("tab", { name: "Runs" })
    );
    await waitForNumRows(page, 4);
    expect(await numRows(page)).toBe(4);

    // make sure run button works under the definition hierarchy as well
    await page.getByTestId("run-now").click();
    await page.getByTestId("run-now-snackbar").isVisible();
    // make sure filtering works in the table
    await waitForNumRows(page, 5);
    expect(await numRows(page)).toBe(5);
  });
  test("Delete schedule button", async ({ page }) => {
    await reset(page);
    await createRun(page, 1);
    await createRun(page, 1);
    await page.goto(`${setup.dashboardUrl}/schedules`);
    await waitForNumRows(page, 2);
    expect(await numRows(page)).toBe(2);
    await navigate(
      setup.dashboardUrl,
      page,
      page.getByTestId("table-row-1").getByTestId("schedule-link")
    );
    await page.getByTestId("delete-schedule").click();
    await page.waitForURL(/\/schedules\/?$/);
    await page.waitForSelector("div#SchedulesTable");
    await waitForNumRows(page, 1);
    expect(await numRows(page)).toBe(1);
    await navigate(
      setup.dashboardUrl,
      page,
      page.getByTestId("table-row-1").getByTestId("schedule-link")
    );
    await page
      .getByTestId("schedule-details")
      .getByTestId("definition-link")
      .click();
    await navigate(
      setup.dashboardUrl,
      page,
      page.getByRole("tab", { name: "Schedules" })
    );
    await waitForNumRows(page, 1);
    expect(await numRows(page)).toBe(1);
    await navigate(
      setup.dashboardUrl,
      page,
      page.getByTestId("table-row-1").getByTestId("schedule-link")
    );
    await page.getByTestId("delete-schedule").click();
    await page.waitForURL(/\/schedules\/?$/);
    await page.waitForSelector("div#SchedulesTable");
    await waitForNumRows(page, 0);
    expect(await numRows(page)).toBe(0);
  });
});
test.describe("Can update a single schedule", () => {
  /**
   * These tests are a bit flaky
   */
  test.describe.configure({ retries: 5 });
  const updateScheduleTests = () => {
    test("Update title", async ({ page }) => {
      expect(await page.getByTestId("schedule-title").innerText()).toBe(
        "Test Title"
      );
      await page.getByTestId("edit-details").click();
      await page
        .getByTestId("edit-details-form")
        .getByTestId("title-field")
        .clear();
      await page
        .getByTestId("edit-details-form")
        .getByTestId("title-field")
        .click();
      await page
        .getByTestId("edit-details-form")
        .getByTestId("title-field")
        .type("hello");
      await page.click(
        `[data-testid="edit-details-form"] [data-testid="submit"]:not(:disabled)`
      );
      await page.waitForURL(/\/\d+\/?$/);
      await page.reload();
      expect(await page.getByTestId("schedule-title").innerText()).toBe(
        "hello"
      );
    });
    test("Update runAt", async ({ page }) => {
      let i = 0;
      while (
        (await page.getByTestId("number-of-runs").innerText()) !== "1" &&
        i++ < 5
      ) {
        await page.reload();
        await sleep(5000);
      }
      expect(await page.getByTestId("number-of-runs").innerText()).toBe("1");

      await page.getByTestId("edit-details").click();

      const runAtField = page
        .getByTestId("edit-details-form")
        .getByTestId("runAt-field");
      await runAtField.clear();

      const now = format(new Date(), "yyyy-MM-dd'T'HH:mm:ss");
      await runAtField.fill(now);

      await page.click(
        `[data-testid="edit-details-form"] [data-testid="submit"]:not(:disabled)`
      );
      await page.waitForURL(/\/\d+\/?$/);
      await page.reload();
      await navigate(
        setup.dashboardUrl,
        page,
        page.getByRole("tab", { name: "Runs" })
      );
      await waitForNumRows(page, 2);
      expect(await numRows(page)).toBe(2);
    });
    test("Unschedule", async ({ page }) => {
      await page.getByTestId("edit-details").click();

      await page
        .getByTestId("edit-details-form")
        .getByTestId("unschedule")
        .click();

      await page.click(
        `[data-testid="edit-details-form"] [data-testid="submit"]:not(:disabled)`
      );
      await page.waitForURL(/\/\d+\/?$/);
      await page.reload();
      await page.getByTestId("no-run-at-edit").click();
    });
    test("Update data", async ({ page }) => {
      expect(
        page.getByTestId("data-card").getByTestId("monaco-loading")
      ).toHaveCount(0, {
        timeout: 20000,
      });

      await page.click('[data-testid="data-card"] .mtk5.detected-link');

      await page.keyboard.type("123");

      expect(
        await page.innerText('[data-testid="data-card"] .mtk5.detected-link')
      ).toBe("http://loc123alhost:3000");
      await page.getByTestId("submit-edit-data").click();
      await page.waitForResponse(/edit-details/);
      await page.reload();
      expect(
        await page.innerText('[data-testid="data-card"] .mtk5.detected-link')
      ).toBe("http://loc123alhost:3000");
    });
  };
  test.beforeEach(async ({ page }) => {
    await reset(page);
    await createRun(page, 1);
    await page.goto(`${setup.dashboardUrl}/schedules`);
    await waitForNumRows(page, 1);
    expect(await numRows(page)).toBe(1);
    await navigate(
      setup.dashboardUrl,
      page,
      page.getByTestId("table-row-1").getByTestId("schedule-link")
    );
  });
  test.describe("Can update on /schedules/$scheduleId", updateScheduleTests);
  test.describe("Can update on /definitions/$definitionId/schedules/$scheduleId", () => {
    test.beforeEach(async ({ page }) => {
      await navigate(
        setup.dashboardUrl,
        page,
        page.getByTestId("schedule-details").getByTestId("definition-link")
      );
      await navigate(
        setup.dashboardUrl,
        page,
        page.getByRole("tab", { name: "Schedules" })
      );
      await navigate(
        setup.dashboardUrl,
        page,
        page.getByTestId("table-row-1").getByTestId("schedule-link")
      );
    });
    updateScheduleTests();
  });
});

test.describe("Can do schedule multi actions", () => {
  test.beforeEach(async ({ page }) => {
    await reset(page);
    await createRun(page, 1, { runTomorrow: true });
    await createRun(page, 1, { runTomorrow: true });
    await createRun(page, 1, { runTomorrow: true });
    await page.goto(`${setup.dashboardUrl}/schedules`);
    await waitForNumRows(page, 3);
  });
  const testMsAction = async (page: Page, btn: string) => {
    await page.getByTestId("table-row-1").getByRole("checkbox").click();
    await page.getByTestId("table-row-2").getByRole("checkbox").click();
    await page.getByTestId(btn).click();
  };
  const testMsDelete = async ({ page }: { page: Page }) => {
    await testMsAction(page, "ms-delete");
    await waitForNumRows(page, 1);
    expect(await numRows(page)).toBe(1);
  };
  const testMsRun = async ({ page }: { page: Page }) => {
    test.slow();
    const expectNumRuns = (row: number) => {
      return expect.poll(
        async () => {
          await page.reload();
          return page
            .getByTestId("table-row-" + row)
            .getByTestId("num-runs")
            .innerText();
        },
        {
          timeout: 60000,
        }
      );
    };
    await page.getByText("Number of runs").click();
    await page.getByText("Number of runs").click();
    await page.waitForURL(/\?sorting=numRuns\.desc/);
    await expectNumRuns(1).toBe("0");
    await expectNumRuns(2).toBe("0");
    await testMsAction(page, "ms-run");
    await expectNumRuns(1).toBe("1");
    await expectNumRuns(2).toBe("1");
  };

  const testUnschedule = async ({ page }: { page: Page }) => {
    const expectRunAt = (row: number) => {
      return expect.poll(
        async () => {
          await page.reload();
          return page
            .getByTestId("table-row-" + row)
            .getByTestId("runAt")
            .innerText();
        },
        {
          timeout: 10000,
        }
      );
    };
    await page.getByText("Next scheduled run").click();
    await page.waitForURL(/\?sorting=runAt\.asc/);
    await expectRunAt(1).toBe("in 23 hours");
    await expectRunAt(2).toBe("in 23 hours");
    await testMsAction(page, "ms-unschedule");
    await expectRunAt(1).toBe("Not scheduled");
    await expectRunAt(2).toBe("Not scheduled");
  };

  test("Can multi delete schedule on /schedules", testMsDelete);
  test("Can multi run schedule on /schedules", testMsRun);
  test("Can multi unschedule on /schedules", testUnschedule);
  test.describe("/definitions/$definitionId/schedules", () => {
    test.beforeEach(async ({ page }) => {
      await navigate(
        setup.dashboardUrl,
        page,
        page.getByTestId("table-row-1").getByTestId("schedule-link")
      );
      await navigate(
        setup.dashboardUrl,
        page,
        page.getByTestId("schedule-details").getByTestId("definition-link")
      );
      await navigate(
        setup.dashboardUrl,
        page,
        page.getByRole("tab", { name: "Schedules" })
      );
    });
    test("Can multi delete schedule", testMsDelete);
    test("Can multi run schedule", testMsRun);
    test("Can multi unschedule", testUnschedule);
  });
});
