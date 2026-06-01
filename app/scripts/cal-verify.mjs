import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "..", "mobile-verify");
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3000";

const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "zh-TW", deviceScaleFactor: 2, isMobile: true });
const page = await ctx.newPage();
const errors = [];
page.on("pageerror", (e) => errors.push(e.message));
page.on("console", (m) => { if (m.type() === "error") errors.push("console:" + m.text()); });

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="account"]', "ren.studio.dev@gmail.com");
await page.fill('input[name="password"]', "admin1234");
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(800);

await page.goto(`${BASE}/calendar/month`, { waitUntil: "networkidle" });
await page.waitForTimeout(1500);
const ov = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, cw: document.documentElement.clientWidth }));
const dayRows = await page.locator("ul > li").count();
const leaveBtns = await page.getByRole("button", { name: /休$/ }).count();
console.log(`overflow: sw=${ov.sw} cw=${ov.cw} ${ov.sw > ov.cw + 1 ? "OVERFLOW!" : "OK"}`);
console.log(`day rows rendered: ${dayRows}`);
console.log(`leave buttons present: ${leaveBtns}`);
console.log(`page errors: ${errors.length ? errors.join(" | ") : "none"}`);
await page.screenshot({ path: join(OUT, "calendar-month-390.png"), fullPage: false });
await b.close();
console.log("DONE");
