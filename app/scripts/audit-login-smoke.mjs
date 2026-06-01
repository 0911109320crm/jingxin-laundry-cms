import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-TW" });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="account"]', "audit");
await page.fill('input[name="password"]', "JxAudit#2022");
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(1500);
console.log("登入後到達:", new URL(page.url()).pathname);

// 1) 唯讀 banner
const banner = await page.getByText(/查帳唯讀模式/).count();
console.log("唯讀 banner:", banner > 0 ? "有" : "無");

// 2) 顧客頁：總數 + 有沒有新增顧客鈕
await page.goto(`${BASE}/customers`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);
const addCust = await page.getByRole("link", { name: /新增顧客/ }).count();
const bodyText = await page.locator("body").innerText();
const mTotal = bodyText.match(/(\d[\d,]*)\s*位/);
console.log("顧客頁 新增鈕:", addCust > 0 ? "有(不該有!)" : "無(正確)");
console.log("顧客頁顯示總數片段:", mTotal ? mTotal[0] : "(未抓到)");

// 3) 嘗試進 dashboard → 應被導回 /customers
await page.goto(`${BASE}/dashboard`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
console.log("嘗試進 /dashboard → 實際到:", new URL(page.url()).pathname, new URL(page.url()).pathname === "/customers" ? "(正確擋下)" : "(沒擋!)");

// 4) 嘗試進 /reports
await page.goto(`${BASE}/reports`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
console.log("嘗試進 /reports → 實際到:", new URL(page.url()).pathname);

// 5) 嘗試進新增訂單頁
await page.goto(`${BASE}/orders/new`, { waitUntil: "networkidle" });
await page.waitForTimeout(600);
console.log("嘗試進 /orders/new → 實際到:", new URL(page.url()).pathname);

console.log("page errors:", errs.length ? errs.join(" | ") : "none");
await b.close();
console.log("DONE");
