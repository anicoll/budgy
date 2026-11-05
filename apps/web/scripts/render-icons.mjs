// Renders the PNG app icons and the share card from the logo mark. Run it
// after changing either: `node scripts/render-icons.mjs`. Needs Playwright with Chromium, which
// is not a dependency here.
import { readFileSync } from "node:fs";
import { chromium } from "playwright";

const mark = (rx, scale) => `
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="100%" height="100%">
  <rect width="64" height="64" rx="${rx}" fill="#0e5561"/>
  <g transform="translate(32 32) scale(${scale}) translate(-32 -32)">
    <g transform="skewX(-12) translate(7 0)">
      <rect x="13" y="34" width="9" height="18" rx="4.5" fill="#f8fafa"/>
      <rect x="27.5" y="24" width="9" height="28" rx="4.5" fill="#f8fafa"/>
      <rect x="42" y="14" width="9" height="38" rx="4.5" fill="#f4a27a"/>
    </g>
  </g>
</svg>`;

// Rounded tiles for browsers; full-bleed squares where the OS applies its own mask.
const icons = [
  { file: "src/app/apple-icon.png", px: 180, rx: 0, scale: 0.9 },
  { file: "public/icon-192.png", px: 192, rx: 16, scale: 1 },
  { file: "public/icon-512.png", px: 512, rx: 16, scale: 1 },
  { file: "public/icon-maskable-512.png", px: 512, rx: 0, scale: 0.78 },
];

const browser = await chromium.launch();
for (const { file, px, rx, scale } of icons) {
  const page = await browser.newPage({ viewport: { width: px, height: px } });
  await page.setContent(
    `<html><body style="margin:0;background:transparent">${mark(rx, scale)}</body></html>`,
  );
  await page.screenshot({ path: file, omitBackground: true });
  await page.close();
  console.log(file);
}
// The 1200 x 630 card shown when someone shares a link to the site.
// Inlined, because a page set from a string can't load file:// fonts.
const font = readFileSync(
  new URL(
    "../node_modules/@fontsource-variable/roboto-flex/files/roboto-flex-latin-opsz-normal.woff2",
    import.meta.url,
  ),
).toString("base64");
const stripes = (light, dark, lead) => `
  <g transform="skewX(-12) translate(7 0)">
    <rect x="13" y="34" width="9" height="18" rx="4.5" fill="${light}"/>
    <rect x="27.5" y="24" width="9" height="28" rx="4.5" fill="${dark}"/>
    <rect x="42" y="14" width="9" height="38" rx="4.5" fill="${lead}"/>
  </g>`;
const card = `
<html><head><style>
  @font-face { font-family: "Roboto Flex"; src: url("data:font/woff2;base64,${font}") format("woff2"); font-weight: 100 1000; }
  body { margin: 0; }
  .card { width: 1200px; height: 630px; box-sizing: border-box; padding: 72px 80px; display: flex;
    flex-direction: column; justify-content: space-between; background: #0e5561; color: #f8fafa;
    font-family: "Roboto Flex", sans-serif; position: relative; overflow: hidden; }
  .ghost { position: absolute; right: -60px; bottom: -110px; opacity: 0.14; }
  .brand { display: flex; align-items: center; gap: 18px; font-size: 56px; font-weight: 700; letter-spacing: -0.03em; }
  h1 { margin: 0 0 20px; font-size: 68px; line-height: 1.05; font-weight: 700; letter-spacing: -0.02em; max-width: 820px; }
  p { margin: 0; font-size: 26px; line-height: 1.4; color: #b0ecfb; max-width: 820px; }
  .foot { display: flex; gap: 20px; font-size: 24px; }
  .url { font-weight: 600; color: #f4a27a; } .dot { color: #94d0de; }
</style></head><body><div class="card">
  <svg class="ghost" width="520" height="520" viewBox="0 0 64 64">${stripes("#f8fafa", "#f8fafa", "#f4a27a")}</svg>
  <div class="brand">
    <svg width="72" height="72" viewBox="0 0 64 64"><rect width="64" height="64" rx="16" fill="#f8fafa"/>${stripes("#0e5561", "#0e5561", "#c25f33")}</svg>
    budgy
  </div>
  <div>
    <h1>Free money tools for Australians.</h1>
    <p>Pay, mortgage, super and debt calculators. No sign-up, and your numbers stay on your device.</p>
  </div>
  <div class="foot"><span class="url">budgy.nicoll.dev</span><span class="dot">·</span><span>Every nickel counts.</span></div>
</div></body></html>`;
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
await page.setContent(card);
await page.evaluate(() => document.fonts.ready);
await page.screenshot({ path: "src/app/opengraph-image.png" });
console.log("src/app/opengraph-image.png");

await browser.close();
