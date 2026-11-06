import { TOOLS } from "../src/lib/tools";
import { expect, test } from "./fixtures";

/**
 * Every page loads, hydrates without errors and fits the screen.
 *
 * The site is prerendered when it's built, and people open it on later days,
 * so these run with the clock two days on from now. That's what catches a page
 * whose first render depends on today's date.
 */
const PAGES = [
  { path: "/", heading: "Money tools that fit your life" },
  ...TOOLS.map((t) => ({ path: `${t.href}/`, heading: null as string | null })),
  { path: "/privacy/", heading: "Privacy" },
];

test.beforeEach(async ({ page }) => {
  await page.clock.setFixedTime(new Date(Date.now() + 2 * 24 * 60 * 60 * 1000));
});

for (const { path, heading } of PAGES) {
  test(`${path} loads`, async ({ page }) => {
    const response = await page.goto(path);
    expect(response?.status()).toBe(200);
    const h1 = page.getByRole("heading", { level: 1 });
    await expect(h1).toBeVisible();
    if (heading) await expect(h1).toHaveText(heading);
    await page.waitForLoadState("networkidle");

    // No sideways scrolling, at phone or desktop width.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow, "page is wider than the screen").toBeLessThanOrEqual(0);
  });
}

test("each tool is linked from the home page", async ({ page }) => {
  await page.goto("/?view=all");
  for (const t of TOOLS) {
    await expect(page.locator(`a[href="${t.href}/"], a[href="${t.href}"]`).first()).toBeAttached();
  }
});

test.describe("an unknown page", () => {
  // The browser logs the 404 response itself.
  test.use({ allowedErrors: [/status of 404/] });

  test("gets the 404 page", async ({ page }) => {
    const response = await page.goto("/no-such-page/");
    expect(response?.status()).toBe(404);
    await expect(page.getByRole("link", { name: /home|tools/i }).first()).toBeVisible();
  });
});
