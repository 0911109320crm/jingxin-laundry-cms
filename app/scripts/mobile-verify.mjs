import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "..", "mobile-verify");
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3000";

const b = await chromium.launch();
// iPhone-ish viewport
const ctx = await b.newContext({ viewport: { width: 390, height: 844 }, locale: "zh-TW", deviceScaleFactor: 2, isMobile: true });
const page = await ctx.newPage();
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="account"]', "ren.studio.dev@gmail.com");
await page.fill('input[name="password"]', "admin1234");
await Promise.all([
  page.waitForURL(u => !u.pathname.includes("/login"), { timeout: 30000 }),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(800);

for (const [name, url] of [["users", "/settings/users"], ["services", "/settings/services"]]) {
  await page.goto(`${BASE}${url}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1200);
  // 量測是否有水平溢出（scrollWidth > clientWidth 代表破版）
  const overflow = await page.evaluate(() => ({
    sw: document.documentElement.scrollWidth,
    cw: document.documentElement.clientWidth,
  }));
  console.log(`${name}: scrollWidth=${overflow.sw} clientWidth=${overflow.cw} ${overflow.sw > overflow.cw + 1 ? "OVERFLOW!" : "OK(no horizontal overflow)"}`);
  await page.screenshot({ path: join(OUT, `${name}-390.png`), fullPage: false });
}
await b.close();
console.log("DONE");
