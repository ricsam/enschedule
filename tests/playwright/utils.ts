import { Locator, Page } from "@playwright/test";
import { Setup } from "./setup";

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
