import { test as base, expect, type Page } from "@playwright/test";

/**
 * Every test fails on a console error or an uncaught exception, including
 * React's hydration errors, which only show in the built site.
 */
export const test = base.extend<{ allowedErrors: RegExp[]; errors: string[] }>({
  allowedErrors: [[], { option: true }],
  errors: [
    async ({ page, allowedErrors }, use) => {
      const errors: string[] = [];
      page.on("console", (m) => {
        if (m.type() === "error") errors.push(m.text());
      });
      page.on("pageerror", (e) => errors.push(String(e)));
      await use(errors);
      const unexpected = errors.filter((e) => !allowedErrors.some((re) => re.test(e)));
      expect(unexpected, "console errors").toEqual([]);
    },
    { auto: true },
  ],
});

export { expect };

/** Type into a field the way a person would: select what's there, then type. */
export async function typeInto(page: Page, label: string | RegExp, value: string) {
  const field = page.getByRole("textbox", { name: label, exact: typeof label === "string" });
  await field.fill("");
  await field.pressSequentially(value);
  await field.blur();
}

/** Pick an option from one of the site's select buttons. */
export async function choose(page: Page, label: string | RegExp, option: string | RegExp) {
  await page.getByRole("button", { name: label }).click();
  await page.getByRole("option", { name: option }).click();
}

/** Text that's showing: the phone and desktop layouts can both be in the page. */
export const shown = (page: Page, text: string) =>
  page.getByText(text, { exact: false }).filter({ visible: true }).first();

/** Dollars as the site shows them, e.g. 55537 → "$55,537". */
export const dollars = (n: number, cents = false) =>
  `$${n.toLocaleString("en-AU", {
    minimumFractionDigits: cents ? 2 : 0,
    maximumFractionDigits: cents ? 2 : 0,
  })}`;
