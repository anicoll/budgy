// Renders the PNG app icons from the logo mark. Run it after changing the
// mark: `node scripts/render-icons.mjs`. Needs Playwright with Chromium, which
// is not a dependency here.
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
await browser.close();
