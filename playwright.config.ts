import { defineConfig, devices } from "@playwright/test";

/**
 * Read environment variables from file.
 * https://github.com/motdotla/dotenv
 */
// require('dotenv').config();

// process.env.SKIP_SETUP is used for development
// SKIP_SETUP=true DASHBOARD_URL=http://localhost:3000 pnpm run playwright test --ui

/**
 * See https://playwright.dev/docs/test-configuration.
 */
export default defineConfig({
  testDir: "./tests/playwright",
  /* Run tests in files in parallel */
  fullyParallel: process.env.SKIP_SETUP || process.env.TEST_HELM ? false : true,
  // fullyParallel: true,
  /* Fail the build on CI if you accidentally left test.only in the source code. */
  forbidOnly: !!process.env.CI,
  /* Retry on CI only */
  // retries: 0, // fail if there are flakyness
  // retries: process.env.CI && process.env.TEST_HELM ? 3 : 2,
  retries: process.env.SKIP_SETUP ? 1 : 3,
  /* Opt out of parallel tests on CI. */
  workers:
    process.env.SKIP_SETUP || process.env.TEST_HELM
      ? 1
      : process.env.CI
      ? 1
      : 10,
  /* Reporter to use. See https://playwright.dev/docs/test-reporters */
  reporter: [
    [
      "html",
      {
        outputFolder: process.env.TEST_HELM
          ? "helm-playwright-report"
          : "playwright-report",
      },
    ],
  ],
  /* Shared settings for all the projects below. See https://playwright.dev/docs/api/class-testoptions. */
  use: {
    /* Base URL to use in actions like `await page.goto('/')`. */
    // baseURL: 'http://127.0.0.1:3000',

    /* Collect trace when retrying the failed test. See https://playwright.dev/docs/trace-viewer */
    // trace: "on-first-retry",
    trace: "on-first-retry",
  },

  /* Configure projects for major browsers */
  projects: [
    process.env.TEST_HELM
      ? {
          name: "helm test",
          use: { ...devices["Desktop Chrome"] },
          testMatch: "helm.spec.ts",
        }
      : process.env.TEST_UTILS
      ? {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
          testMatch: "utils.spec.ts",
        }
      : {
          name: "chromium",
          use: { ...devices["Desktop Chrome"] },
          testMatch: "dashboard.spec.ts",
        },
  ],
});
