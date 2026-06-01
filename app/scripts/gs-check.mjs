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
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);

// 開啟 Ctrl+K
await page.keyboard.press("Control+k");
await page.waitForTimeout(400);
const quickBox = page.getByPlaceholder("輸入電話或地址…");
const fullBox = page.getByPlaceholder("輸入後按 Enter 搜尋…");
console.log("快速框出現:", await quickBox.count(), " 完整框出現:", await fullBox.count());

// 快速搜尋：打電話前綴
const t1 = Date.now();
await quickBox.fill("0912");
await page.waitForTimeout(1200);
const quickRows = await page.locator("button:has(.rounded-full)").count();
console.log(`快速搜尋"0912" → ${quickRows} 筆 (耗時約 ${Date.now() - t1}ms 含 debounce)`);

// 完整搜尋：打姓名 + Enter
await fullBox.fill("林");
const t2 = Date.now();
await fullBox.press("Enter");
await page.waitForTimeout(1500);
const bodyTxt = await page.locator(".max-w-xl").innerText();
console.log(`完整搜尋"林" Enter 後 → 含「顧客」section: ${bodyTxt.includes("顧客")}, 耗時約 ${Date.now() - t2}ms`);
await page.screenshot({ path: join(OUT, "global-search-2row.png"), clip: { x: 230, y: 60, width: 640, height: 520 } });
console.log("errors:", errs.length ? errs.join(" | ") : "none");
await b.close(); console.log("DONE");
