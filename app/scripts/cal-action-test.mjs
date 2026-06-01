import { chromium } from "playwright";
const BASE = "http://localhost:3000";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 390, height: 900 }, locale: "zh-TW", isMobile: true });
const page = await ctx.newPage();
const errs = [];
page.on("pageerror", (e) => errs.push(e.message));

await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="account"]', "ren.studio.dev@gmail.com");
await page.fill('input[name="password"]', "admin1234");
await Promise.all([
  page.waitForURL((u) => !u.pathname.includes("/login"), { timeout: 30000 }),
  page.click('button[type="submit"]'),
]);
await page.goto(`${BASE}/calendar/month`, { waitUntil: "networkidle" });
await page.waitForTimeout(1200);

// 第 1 天那一列
const firstLi = page.locator("ul > li").first();
console.log("set 全日休 ...");
await firstLi.getByRole("button", { name: "全日休" }).click();
await page.waitForTimeout(1500);
const badge = await firstLi.getByText("全日休").count();
const cancelBtn = await firstLi.getByRole("button", { name: "取消休假" }).count();
console.log(`after set → 全日休 badge=${badge>0}, 取消休假 btn=${cancelBtn>0}`);

console.log("remove 休假 ...");
await firstLi.getByRole("button", { name: "取消休假" }).click();
await page.waitForTimeout(1500);
const backBtns = await firstLi.getByRole("button", { name: /休$/ }).count();
console.log(`after remove → leave buttons back=${backBtns} (expect 3)`);
console.log(`page errors: ${errs.length ? errs.join(" | ") : "none"}`);
await b.close();
console.log("DONE");
