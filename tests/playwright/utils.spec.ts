import { test } from "@playwright/test";
import { Setup } from "./setup";
import { utils } from "./utils";

const setup = new Setup();

test.beforeEach(async () => {
  test.setTimeout(120 * 1000);
  await setup.setup();
});
test.afterEach(async () => {
  await setup.teardown();
});

const { reset, createRun, visitRunPages, login, addLoginCookie } = utils(
  {
    get dashboardUrl() {
      return setup.dashboardUrl;
    },
    get workerUrl() {
      return setup.workerUrl;
    },
  }
);

test("create_many_runs", async ({ page }) => {
  test.slow();
  await reset(page);
  await login(page);
  for (let j = 0; j < 50; j += 1) {
    await createRun(page, (j % 4) + 1);
  }
});
