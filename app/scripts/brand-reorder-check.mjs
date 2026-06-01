import { chromium } from "playwright";
import { mkdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const OUT = resolve(dirname(fileURLToPath(import.meta.url)), "..", "..", "mobile-verify");
mkdirSync(OUT, { recursive: true });
const BASE = "http://localhost:3000";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1100, height: 900 }, locale: "zh-TW" });
const page = await ctx.newPage();
const errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="account"]', "ren.studio.dev@gmail.com");
await page.fill('input[name="password"]', "admin1234");
await Promise.all([page.waitForURL(u => !u.pathname.includes("/login"), { timeout: 30000 }), page.click('button[type="submit"]')]);
await page.goto(`${BASE}/settings/machine-brands`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

const names = () => page.locator(".max-w-2xl > div span.flex-1, .max-w-2xl > div span.truncate").allInnerTexts();
const before = (await page.locator(".max-w-2xl > div").locator("span.font-medium").allInnerTexts()).slice(0, 4);
console.log("調整前前4:", before.join(" | "));

// 點第一列的「下移」(第一個 ChevronDown)
const firstRow = page.locator(".max-w-2xl > div").first();
await firstRow.locator('button[title="下移"]').click();
await page.waitForTimeout(1500);
const after = (await page.locator(".max-w-2xl > div").locator("span.font-medium").allInnerTexts()).slice(0, 4);
console.log("下移後前4:", after.join(" | "));
console.log("前兩名是否互換:", before[0] === after[1] && before[1] === after[0] ? "是(正確)" : "否");

// 還原：把它移回去（現在它在第2位 → 點第2列上移）
await page.locator(".max-w-2xl > div").nth(1).locator('button[title="上移"]').click();
await page.waitForTimeout(1500);
const restored = (await page.locator(".max-w-2xl > div").locator("span.font-medium").allInnerTexts()).slice(0, 4);
console.log("還原後前4:", restored.join(" | "), "->", restored[0] === before[0] ? "已還原" : "未還原");
await page.screenshot({ path: join(OUT, "brand-reorder.png"), clip: { x: 220, y: 60, width: 640, height: 420 } });
console.log("errors:", errs.length ? errs.join(" | ") : "none");
await b.close(); console.log("DONE");
