// One-off: screenshot the 2026-05-31 updated features for the owner handover doc.
// Requires the server running on :3000. Run: node scripts/handover-shots.mjs
import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { mkdir, readFileSync } from "node:fs";
import { mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const BASE = "http://localhost:3000";
const EMAIL = "ren.studio.dev@gmail.com";
const PASSWORD = "admin1234";
const OUT = resolve(__dirname, "..", "..", "handover-shots");
mkdirSync(OUT, { recursive: true });

// --- find a customer that already has machines (for the "帶入機器" shot) ---
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8")
    .split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("="))
    .map(l => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim()]; })
);
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } });
const { data: mach } = await sb.from("machines")
  .select("customer_id").not("customer_id", "is", null).limit(50);
const custWithMachine = (mach ?? [])[0]?.customer_id ?? null;
console.log("customer with machine:", custWithMachine);

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 1320, height: 900 }, locale: "zh-TW", deviceScaleFactor: 2 });
const page = await ctx.newPage();
const shot = async (name, opts = {}) => { await page.screenshot({ path: join(OUT, name), ...opts }); console.log("shot", name); };
// 把含個資的元素打碼（模糊），只保留要示範的功能區
const blurSel = async (selectors) => {
  await page.evaluate((sels) => {
    for (const s of sels) {
      document.querySelectorAll(s).forEach((el) => {
        el.style.filter = "blur(7px)";
        el.style.userSelect = "none";
      });
    }
  }, selectors);
  await page.waitForTimeout(150);
};

// login
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="account"]', EMAIL);
await page.fill('input[name="password"]', PASSWORD);
await Promise.all([
  page.waitForURL(u => !u.pathname.includes("/login"), { timeout: 30000 }),
  page.click('button[type="submit"]'),
]);
await page.waitForTimeout(800);

// 1) 客戶搜尋（建單）
await page.goto(`${BASE}/orders/new`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
const picker = page.getByPlaceholder(/打字搜尋客戶/);
await picker.click();
await picker.fill("林");
await page.waitForTimeout(1200);
// 打碼：搜尋結果下拉(含客戶姓名/含電話的編號)
await blurSel(['div[class*="absolute"][class*="z-20"]']);
await shot("01-customer-search.png", { clip: { x: 0, y: 120, width: 1320, height: 520 } });

// 2) 建單表單：選客戶(有機器者) + 服務項目中文 + 設備資訊 + 帶入機器
if (custWithMachine) {
  await page.goto(`${BASE}/orders/new?customer=${custWithMachine}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(1500);
}
// 選第一個服務項目（中文）
try {
  const svc = page.locator("select").filter({ has: page.locator("option", { hasText: "洗衣機" }) }).first();
  await svc.selectOption({ index: 1 });
  await page.waitForTimeout(400);
} catch (e) { console.log("svc select skip", e.message); }
await page.waitForTimeout(500);
// 打碼：已選客戶名片(姓名/編號/電話) + 服務地址下拉(地址)
await blurSel(['div.h-10.justify-between', "select[name='address_id']"]);
await shot("02-order-form.png", { fullPage: true });

// 3) 顧客詳情：建檔日期（只截 header，打碼姓名/電話，保留「建檔」）
const cid = custWithMachine;
if (cid) {
  await page.goto(`${BASE}/customers/${cid}`, { waitUntil: "networkidle" });
  await page.waitForTimeout(900);
  // 打碼：姓名那一列 + 所有電話連結（建檔日期是獨立 <p>，不受影響）
  await page.evaluate(() => {
    const h1 = document.querySelector("h1");
    if (h1 && h1.parentElement) h1.parentElement.style.filter = "blur(7px)";
    document.querySelectorAll('a[href^="tel:"]').forEach((a) => {
      a.style.filter = "blur(6px)";
    });
  });
  await page.waitForTimeout(150);
  // 緊裁：姓名列(已模糊)+電話(已模糊)+建檔日期(清晰)+KPI，止於地址卡之前
  await shot("03-build-date.png", { clip: { x: 0, y: 88, width: 1320, height: 150 } });
}

// 4) 顧客機器登錄（無子類型）
await page.goto(`${BASE}/customers/new`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
try {
  await page.getByRole("button", { name: /新增機器/ }).click();
  await page.waitForTimeout(500);
  const card = page.locator("text=機器 / 服務物品").locator("xpath=ancestor::*[contains(@class,'rounded')][1]").first();
  await card.scrollIntoViewIfNeeded();
  await shot("04-machine-no-subtype.png", { clip: { x: 0, y: 0, width: 1320, height: 900 } });
} catch (e) { console.log("machine card skip", e.message); await shot("04-machine-no-subtype.png", { fullPage: true }); }

// 5) 品牌主檔精簡
await page.goto(`${BASE}/settings/machine-brands`, { waitUntil: "networkidle" });
await page.waitForTimeout(800);
await shot("06-brands.png", { fullPage: true });

await browser.close();
console.log("DONE →", OUT);
