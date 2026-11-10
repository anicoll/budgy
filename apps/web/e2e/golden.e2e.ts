import type { Page } from "@playwright/test";
import {
  HELP_BARRY_2026_27,
  LOAN_600K_6PC_30Y,
  NSW_DUTY_1_35M,
  PAY_100K_2025_26,
  QLD_HOME_950K,
} from "../../../packages/engine/src/golden/cases";
import { choose, dollars, expect, shown, test, typeInto } from "./fixtures";

/**
 * The engine's golden cases, typed into the pages. The engine tests pin each
 * figure to its published source; these check the page shows the same number.
 */

/** The pay results "per" control: buttons on a wide screen, a select on a phone. */
async function showPer(page: Page, per: string) {
  const select = page.getByRole("button", { name: /Show per$/ });
  if (await select.isVisible()) await choose(page, /Show per$/, per);
  else
    await page
      .getByRole("group", { name: "View" })
      .locator("..")
      .getByRole("button", { name: per, exact: true })
      .click();
}

/** The stamp duty breakdown ("How this is calculated"), open or not. */
const dutyWorking = (page: Page) => page.locator("details", { hasText: "How this is calculated" });

test(`pay: ${PAY_100K_2025_26.name}`, async ({ page }) => {
  const { input, expected } = PAY_100K_2025_26;
  await page.goto("/pay/");
  await typeInto(page, "Salary", String(input.salary));
  await choose(page, /Financial year/, new RegExp(`^${input.year}`));
  await showPer(page, "Year");

  await expect(shown(page, `${dollars(expected.net, true)} a year`)).toBeVisible();
  await expect(shown(page, `−${dollars(expected.incomeTax, true)}`)).toBeVisible();
  await expect(shown(page, `−${dollars(expected.medicare, true)}`)).toBeVisible();
});

test(`mortgage: ${LOAN_600K_6PC_30Y.name}`, async ({ page }) => {
  const { input, expected } = LOAN_600K_6PC_30Y;
  await page.goto("/mortgage/");
  await typeInto(page, "Loan balance", String(input.amount));
  await page
    .getByRole("spinbutton", { name: "Interest rate", exact: true })
    .fill(String(input.rate * 100));
  await page.getByRole("spinbutton", { name: "Years left", exact: true }).fill(String(input.years));

  await expect(shown(page, dollars(expected.monthly, true))).toBeVisible();
});

test(`buying costs: ${NSW_DUTY_1_35M.name}`, async ({ page }) => {
  await page.goto("/buying-costs/");
  await choose(page, /State or territory/, "New South Wales");
  await typeInto(page, "Purchase price", String(NSW_DUTY_1_35M.input.price));
  await page.getByRole("button", { name: "Living in it" }).click();
  await page.getByRole("button", { name: "Existing home" }).click();

  await expect(dutyWorking(page)).toContainText(dollars(NSW_DUTY_1_35M.expected.duty, true));
});

test(`buying costs: ${QLD_HOME_950K.name}`, async ({ page }) => {
  await page.goto("/buying-costs/");
  await choose(page, /State or territory/, "Queensland");
  await typeInto(page, "Purchase price", String(QLD_HOME_950K.input.price));
  await page.getByRole("button", { name: "Living in it" }).click();
  await page.getByRole("button", { name: "Existing home" }).click();

  await expect(dutyWorking(page)).toContainText(dollars(QLD_HOME_950K.expected.duty, true));
});

test(`HELP: ${HELP_BARRY_2026_27.name}`, async ({ page }) => {
  // The page uses this income year's thresholds, so pin the clock inside 2026-27.
  await page.clock.setFixedTime(new Date("2027-03-01T10:00:00+11:00"));
  const { input, expected } = HELP_BARRY_2026_27;
  await page.goto("/pay-off-help/");
  await typeInto(page, "Income this year", String(input.taxableIncome + input.reportableSuper));

  await expect(page.getByText(/^Compulsory repayment:/)).toContainText(
    `${dollars(Math.round(expected.repayment))} a year`,
  );
});
