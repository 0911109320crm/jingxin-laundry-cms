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

const rowNames = async () => (await page.locator(".max-w-2xl > div").locator("span.font-medium").allInnerTexts()).slice(0, 5);
const before = await rowNames();
console.log("調整前:", before.join(" | "));

// 把最後一個(第N)輸入順序改成 1
const rows = page.locator(".max-w-2xl > div");
const n = await rows.count();
const lastName = (await rows.nth(n - 1).locator("span.font-medium").innerText());
const inp = rows.nth(n - 1).locator('input[type="number"]');
await inp.fill("1");
await inp.press("Enter");
await page.waitForTimeout(1800);
const after = await rowNames();
console.log("把最後一個(", lastName, ")改成順序1 後:", after.join(" | "));
console.log("最後一個是否移到第一位:", after[0] === lastName ? "是(正確)" : "否");

// 還原：把它(現在第1)改回 N
const firstInp = page.locator(".max-w-2xl > div").first().locator('input[type="number"]');
await firstInp.fill(String(n));
await firstInp.press("Enter");
await page.waitForTimeout(1800);
const restored = await rowNames();
console.log("還原後:", restored.join(" | "), "->", restored[0] === before[0] ? "已還原" : "未還原");
await page.screenshot({ path: join(OUT, "brand-num-reorder.png"), clip: { x: 220, y: 60, width: 640, height: 420 } });
console.log("errors:", errs.length ? errs.join(" | ") : "none");
await b.close(); console.log("DONE");
