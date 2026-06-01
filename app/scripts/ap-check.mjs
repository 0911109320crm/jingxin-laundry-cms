import { chromium } from "playwright";
import { createClient } from "@supabase/supabase-js";
import { readFileSync, mkdirSync } from "node:fs";
import { resolve, join, dirname } from "node:path";
import { fileURLToPath } from "node:url";
const __dirname = dirname(fileURLToPath(import.meta.url));
const OUT = resolve(__dirname, "..", "..", "mobile-verify");
mkdirSync(OUT, { recursive: true });
const env = Object.fromEntries(readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8").split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("=")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const sb = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
// 找一個有 >=2 地址的客戶
const { data: rows } = await sb.from("customer_addresses").select("customer_id").limit(2000);
const cnt = {}; for (const r of rows ?? []) cnt[r.customer_id] = (cnt[r.customer_id] || 0) + 1;
const cid = Object.entries(cnt).sort((a, b) => b[1] - a[1])[0]?.[0];
console.log("測試客戶:", cid, "地址數:", cnt[cid]);

const BASE = "http://localhost:3000";
const b = await chromium.launch();
const ctx = await b.newContext({ viewport: { width: 1280, height: 900 }, locale: "zh-TW" });
const page = await ctx.newPage();
const errs = []; page.on("pageerror", e => errs.push(e.message));
await page.goto(`${BASE}/login`, { waitUntil: "networkidle" });
await page.fill('input[name="account"]', "ren.studio.dev@gmail.com");
await page.fill('input[name="password"]', "admin1234");
await Promise.all([page.waitForURL(u => !u.pathname.includes("/login"), { timeout: 30000 }), page.click('button[type="submit"]')]);
await page.goto(`${BASE}/orders/new?customer=${cid}`, { waitUntil: "networkidle" });
await page.waitForTimeout(1800);
// 地址應已自動選一個 → 顯示「變更」
const changeBtn = page.getByRole("button", { name: "變更" });
console.log("地址已自動選並顯示變更鈕:", (await changeBtn.count()) > 0);
if (await changeBtn.count()) { await changeBtn.first().click(); await page.waitForTimeout(400); }
const searchBox = page.getByPlaceholder(/搜尋或選擇地址/);
console.log("出現地址搜尋框:", (await searchBox.count()) > 0);
await page.screenshot({ path: join(OUT, "address-search.png"), clip: { x: 240, y: 150, width: 560, height: 320 } });
console.log("errors:", errs.length ? errs.join(" | ") : "none");
await b.close(); console.log("DONE");
