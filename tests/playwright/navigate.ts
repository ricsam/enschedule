import { Locator, Page } from "@playwright/test";
import { baseURL } from "./url";

export const navigate = async (page: Page, link: Locator) => {
  const url = await link.getAttribute("href");

  if (!url) {
    throw new Error("invalid URL");
  }

  await page.goto(baseURL + url);
};
