#!/usr/bin/env node
/**
 * Demo seed for Jingxin Laundry CMS
 *
 * Usage:
 *   node scripts/seed-demo.mjs           - insert demo data (idempotent on codes/emails)
 *   node scripts/seed-demo.mjs --reset   - wipe existing demo data first, then re-insert
 *
 * Demo accounts (all password: admin1234):
 *   borenchang+wang@gmail.com    - 王大哥     (technician)
 *   borenchang+lin@gmail.com     - 林師傅     (technician)
 *   borenchang+chen@gmail.com    - 陳師傅     (technician)
 *   borenchang+huang@gmail.com   - 黃師傅     (technician)
 *   borenchang+manager@gmail.com - 老闆娘助理 (manager)
 */

import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const envPath = resolve(__dirname, "..", ".env.local");

const env = Object.fromEntries(
  readFileSync(envPath, "utf-8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => {
      const [k, ...r] = l.split("=");
      return [k.trim(), r.join("=").trim()];
    }),
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } },
);

const RESET = process.argv.includes("--reset");

const STAFF = [
  { email: "borenchang+wang@gmail.com",    name: "王大哥",     role: "technician" },
  { email: "borenchang+lin@gmail.com",     name: "林師傅",     role: "technician" },
  { email: "borenchang+chen@gmail.com",    name: "陳師傅",     role: "technician" },
  { email: "borenchang+huang@gmail.com",   name: "黃師傅",     role: "technician" },
  { email: "borenchang+manager@gmail.com", name: "老闆娘助理", role: "manager"    },
];

const CUSTOMERS = [
  { code: "C2026-001", name: "王太太", phone: "0912340001", source: "LINE",
    note: "老客戶，每年都會回購",
    addresses: [{ county: "彰化縣", district: "田尾鄉", address: "光復路一段123號", label: "家", is_default: true }],
    machines: [{ type: "washing_machine", brand: "LG", model: "WT-138RG", sub_type: "直立式" }] },
  { code: "C2026-002", name: "陳先生", phone: "0912340002", source: "Google",
    addresses: [
      { county: "彰化縣", district: "員林市", address: "中山路二段45號", is_default: true },
      { county: "彰化縣", district: "彰化市", address: "中正路150號", label: "公司" }],
    machines: [
      { type: "washing_machine", brand: "大同", model: "TAW-110A", sub_type: "直立式" },
      { type: "air_conditioner", brand: "日立", model: "RAC-50JK", sub_type: "分離式" },
      { type: "sofa", sub_type: "三人座", note: "深咖啡色，明顯髒污" }] },
  { code: "C2026-003", name: "林小姐", phone: "0912340003", source: "老客介紹",
    addresses: [{ county: "彰化縣", district: "溪湖鎮", address: "員鹿路三段88號", is_default: true }],
    machines: [{ type: "washing_machine", brand: "Panasonic", model: "NA-V160LB", sub_type: "滾筒式" }] },
  { code: "C2026-004", name: "黃先生", phone: "0912340004", source: "Facebook",
    note: "住二樓，需爬樓梯",
    addresses: [{ county: "台中市", district: "南屯區", address: "文心路一段456號", is_default: true }],
    machines: [
      { type: "washing_machine", brand: "LG", model: "F2514DTGW", sub_type: "滾筒式" },
      { type: "air_conditioner", brand: "大金", model: "RXP41JVLT", sub_type: "分離式" }] },
  { code: "C2026-005", name: "張媽媽", phone: "0912340005", source: "LINE",
    addresses: [{ county: "彰化縣", district: "北斗鎮", address: "中華路200號", is_default: true }],
    machines: [{ type: "mattress", sub_type: "雙人加大", note: "床墊有黃斑" }] },
  { code: "C2026-006", name: "李董", phone: "0912340006", source: "關鍵電話",
    note: "公司大老闆，要求準時",
    addresses: [
      { county: "台中市", district: "西屯區", address: "台灣大道四段888號", label: "辦公室", is_default: true },
      { county: "台中市", district: "北屯區", address: "崇德路三段100號", label: "住家" }],
    machines: [
      { type: "air_conditioner", brand: "日立", model: "RAS-90NK", sub_type: "分離式" },
      { type: "sofa", sub_type: "五人座", note: "皮沙發" }] },
  { code: "C2026-007", name: "吳太太", phone: "0912340007", source: "LINE",
    addresses: [{ county: "南投縣", district: "南投市", address: "中興路50號", is_default: true }],
    machines: [{ type: "washing_machine", brand: "聲寶", model: "ES-L17DPS", sub_type: "直立式", note: "機齡 8 年" }] },
  { code: "C2026-008", name: "劉先生", phone: "0912340008", source: "跟車",
    addresses: [{ county: "雲林縣", district: "斗六市", address: "雲林路一段300號", is_default: true }],
    machines: [{ type: "washing_machine", brand: "Hitachi", model: "BD-NX125", sub_type: "滾筒式" }] },
  { code: "C2026-009", name: "蔡小姐", phone: "0912340009", source: "老客介紹",
    addresses: [{ county: "彰化縣", district: "鹿港鎮", address: "中山路180號", is_default: true }],
    machines: [
      { type: "washing_machine", brand: "LG", model: "WT-D173MG", sub_type: "直立式" },
      { type: "mattress", sub_type: "單人" }] },
  { code: "C2026-010", name: "許阿姨", phone: "0912340010", source: "LINE",
    addresses: [{ county: "彰化縣", district: "和美鎮", address: "彰美路五段66號", is_default: true }],
    machines: [{ type: "washing_machine", brand: "東元", model: "W1058FW", sub_type: "直立式" }] },
  { code: "C2026-011", name: "周先生", phone: "0912340011", source: "Google",
    addresses: [{ county: "台中市", district: "北區", address: "一中街100號", is_default: true }],
    machines: [{ type: "air_conditioner", brand: "東元", model: "MS50IE-HS", sub_type: "分離式" }] },
  { code: "C2026-012", name: "楊太太", phone: "0912340012", source: "LINE",
    note: "養兩隻狗，沙發有毛",
    addresses: [{ county: "彰化縣", district: "芳苑鄉", address: "芳漢路999號", is_default: true }],
    machines: [{ type: "sofa", sub_type: "三人座", note: "布沙發，有寵物毛" }] },
  { code: "C2026-013", name: "鄭先生", phone: "0912340013", source: "現場推廣告",
    addresses: [{ county: "雲林縣", district: "虎尾鎮", address: "雲林科技大學旁", is_default: true }],
    machines: [{ type: "washing_machine", brand: "Sharp", model: "ES-ASF13T", sub_type: "直立式" }] },
  { code: "C2026-014", name: "何小姐", phone: "0912340014", source: "Facebook",
    addresses: [{ county: "南投縣", district: "草屯鎮", address: "中正路500號", is_default: true }],
    machines: [
      { type: "washing_machine", brand: "美的", model: "MFW-100M5MS", sub_type: "滾筒式" },
      { type: "mattress", sub_type: "雙人" }] },
  { code: "C2026-015", name: "蘇阿姨", phone: "0912340015", source: "LINE",
    addresses: [{ county: "彰化縣", district: "田中鎮", address: "中州路180號", is_default: true }],
    machines: [{ type: "washing_machine", brand: "LG", model: "WD-S15TBD", sub_type: "滾筒式" }] },

  // ==== 沉睡客戶：上次服務在 11-13 個月前，之後沒再聯絡（會出現在即將到期清單）====
  { code: "C2026-016", name: "周阿伯", phone: "0922340016", source: "LINE",
    note: "去年清過一次後沒再聯絡",
    addresses: [{ county: "彰化縣", district: "員林市", address: "員水路一段100號", is_default: true }],
    machines: [{ type: "washing_machine", brand: "三洋", model: "ASW-115HTB", sub_type: "直立式" }] },
  { code: "C2026-017", name: "錢先生", phone: "0922340017", source: "Google",
    note: "去年清過冷氣，今年該再來",
    addresses: [{ county: "台中市", district: "西區", address: "美村路一段250號", is_default: true }],
    machines: [{ type: "air_conditioner", brand: "三菱", model: "MUY-GE71VA", sub_type: "分離式" }] },
  { code: "C2026-018", name: "孫老師", phone: "0922340018", source: "老客介紹",
    note: "13 個月前清過洗衣機，已逾期一個月",
    addresses: [{ county: "南投縣", district: "埔里鎮", address: "中山路200號", is_default: true }],
    machines: [{ type: "washing_machine", brand: "LG", model: "WT-D169SG", sub_type: "直立式" }] },
  { code: "C2026-019", name: "趙太太", phone: "0922340019", source: "Facebook",
    note: "床墊去年清過",
    addresses: [{ county: "雲林縣", district: "斗六市", address: "明德路三段88號", is_default: true }],
    machines: [{ type: "mattress", sub_type: "雙人加大", note: "去年清過一次" }] },
];

function pad(n) { return String(n).padStart(2, "0"); }

function dayOffset(daysFromToday, hour = 10, minute = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

// Estimate duration in minutes based on service codes
function estimateMinutes(items) {
  let max = 60;
  for (const it of items) {
    const code = it.svc;
    let dur = 90;
    if (code === "C") dur = 180;          // 分離式冷氣
    else if (code === "B") dur = 150;     // 滾筒洗衣機
    else if (code === "E") dur = 120;     // 沙發清潔
    else if (code === "D") dur = 90;      // 床墊清潔
    else if (code === "A") dur = 90;      // 直立式洗衣機
    if (dur > max) max = dur;
  }
  // Multi-item adds a bit more (pessimistic)
  return max + (items.length - 1) * 30;
}

function endOf(startIso, items) {
  if (!startIso) return null;
  const d = new Date(startIso);
  d.setMinutes(d.getMinutes() + estimateMinutes(items));
  return d.toISOString();
}

// Order recipes: c = customer code, t = technician index (0..3), null = unassigned
const ORDERS = [
  // ==== 11-13 個月前歷史訂單（沉睡客戶，會觸發「即將到期」提醒）====
  { c: "C2026-016", sched: dayOffset(-365, 10), service: dayOffset(-365, 11), t: 0,
    status: "done", pay: "cash", settle: "settled",
    items: [{ svc: "A", price: 1800 }] },
  { c: "C2026-017", sched: dayOffset(-345, 14), service: dayOffset(-345, 15), t: 1,
    status: "done", pay: "transfer",
    items: [{ svc: "C", price: 2500 }] },
  { c: "C2026-018", sched: dayOffset(-395, 9), service: dayOffset(-395, 10), t: 2,
    status: "done", pay: "cash", settle: "settled",
    items: [{ svc: "B", price: 3800 }] },
  { c: "C2026-019", sched: dayOffset(-340, 14), service: dayOffset(-340, 15), t: 3,
    status: "done", pay: "cash", settle: "settled",
    items: [{ svc: "D", price: 2000 }] },

  // ==== Past 2 weeks: completed cash, already settled (回繳完畢) ====
  { c: "C2026-001", sched: dayOffset(-14, 10), service: dayOffset(-14, 11), t: 0,
    status: "done", pay: "cash", settle: "settled",
    items: [{ svc: "A", price: 1800 }] },
  { c: "C2026-002", sched: dayOffset(-13, 14), service: dayOffset(-13, 15), t: 1,
    status: "done", pay: "cash", settle: "settled",
    items: [{ svc: "A", price: 1800 }, { svc: "C", price: 2500 }] },
  { c: "C2026-009", sched: dayOffset(-12, 9), service: dayOffset(-12, 10), t: 2,
    status: "done", pay: "transfer",
    items: [{ svc: "B", price: 3800 }],
    addons: [{ name: "加大", amount: 200 }] },

  // ==== Past week: cash done, NOT settled (這些會出現在待回繳頁) ====
  { c: "C2026-004", sched: dayOffset(-7, 14), service: dayOffset(-7, 15), t: 0,
    status: "done", pay: "cash",
    items: [{ svc: "B", price: 3800 }, { svc: "C", price: 2500 }] },
  { c: "C2026-005", sched: dayOffset(-6, 10), service: dayOffset(-6, 11), t: 1,
    status: "done", pay: "cash",
    items: [{ svc: "D", price: 2000 }] },
  { c: "C2026-006", sched: dayOffset(-5, 14), service: dayOffset(-5, 15), t: 0,
    status: "done", pay: "cash",
    items: [{ svc: "C", price: 2500 }, { svc: "E", price: 2400 }] },
  { c: "C2026-007", sched: dayOffset(-4, 9), service: dayOffset(-4, 10), t: 2,
    status: "done", pay: "cash",
    items: [{ svc: "A", price: 1800 }],
    addons: [{ name: "其他加價", amount: 300 }] },
  { c: "C2026-008", sched: dayOffset(-3, 14), service: dayOffset(-3, 15), t: 3,
    status: "done", pay: "cash",
    items: [{ svc: "B", price: 3800 }] },
  { c: "C2026-010", sched: dayOffset(-2, 10), service: dayOffset(-2, 11), t: 1,
    status: "done", pay: "cash",
    items: [{ svc: "A", price: 1800 }, { svc: "D", price: 2000 }] },
  { c: "C2026-011", sched: dayOffset(-1, 14), service: dayOffset(-1, 15), t: 0,
    status: "done", pay: "cash",
    items: [{ svc: "A", price: 1800 }],
    addons: [{ name: "折扣", amount: 100 }] },

  // ==== Past, transfer (paid online, no settlement) ====
  { c: "C2026-003", sched: dayOffset(-4, 14), service: dayOffset(-4, 15), t: 2,
    status: "done", pay: "transfer",
    items: [{ svc: "C", price: 2500 }] },

  // ==== Today: in progress / scheduled ====
  { c: "C2026-012", sched: dayOffset(0, 10), t: 1,
    status: "in_progress", pay: "unpaid",
    items: [{ svc: "E", price: 2400 }] },
  { c: "C2026-013", sched: dayOffset(0, 14), t: 0,
    status: "scheduled", pay: "unpaid",
    items: [{ svc: "A", price: 1800 }] },

  // ==== Tomorrow / next week: scheduled ====
  { c: "C2026-014", sched: dayOffset(1, 10), t: 2,
    status: "scheduled", pay: "transfer",
    items: [{ svc: "B", price: 3800 }, { svc: "D", price: 2000 }] },
  { c: "C2026-015", sched: dayOffset(1, 14), t: 3,
    status: "scheduled", pay: "unpaid",
    items: [{ svc: "B", price: 3800 }] },
  { c: "C2026-001", sched: dayOffset(2, 9), t: 0,
    status: "scheduled", pay: "unpaid",
    items: [{ svc: "A", price: 1800 }] },
  { c: "C2026-002", sched: dayOffset(3, 14), t: 1,
    status: "scheduled", pay: "unpaid",
    items: [{ svc: "C", price: 2500 }] },
  { c: "C2026-003", sched: dayOffset(4, 10), t: 2,
    status: "scheduled", pay: "unpaid",
    items: [{ svc: "B", price: 3800 }] },
  { c: "C2026-004", sched: dayOffset(5, 14), t: 3,
    status: "scheduled", pay: "unpaid",
    items: [{ svc: "C", price: 2500 }] },
  { c: "C2026-005", sched: dayOffset(7, 10), t: 0,
    status: "scheduled", pay: "unpaid",
    items: [{ svc: "A", price: 1800 }] },

  // ==== Pending 待派工（左側面板會顯示這些）====
  { c: "C2026-006", sched: null, t: null,
    status: "pending", pay: "unpaid",
    items: [{ svc: "C", price: 2500 }] },
  { c: "C2026-009", sched: null, t: null,
    status: "pending", pay: "unpaid",
    items: [{ svc: "A", price: 1800 }, { svc: "D", price: 2000 }] },
  { c: "C2026-012", sched: null, t: null,
    status: "pending", pay: "transfer",
    items: [{ svc: "E", price: 2400 }] },
  { c: "C2026-002", sched: null, t: null,
    status: "pending", pay: "unpaid",
    items: [{ svc: "A", price: 1800 }, { svc: "C", price: 2500 }] },
];

async function listAllAuthUsers() {
  // listUsers handles pagination internally up to perPage; for demo size 200 is plenty
  const { data } = await supabase.auth.admin.listUsers({ perPage: 200 });
  return data?.users ?? [];
}

async function findUserByEmail(email) {
  const users = await listAllAuthUsers();
  return users.find((u) => u.email === email) ?? null;
}

async function reset() {
  console.log("Reset mode: deleting demo data...");
  const codes = CUSTOMERS.map((c) => c.code);

  // Look up customer IDs first
  const { data: existingCustomers } = await supabase
    .from("customers").select("id").in("code", codes);
  const cIds = (existingCustomers ?? []).map((c) => c.id);

  if (cIds.length > 0) {
    // Orders FK to customers is ON DELETE RESTRICT, so kill orders first (cascade items/adj)
    const { error: oErr } = await supabase
      .from("orders").delete().in("customer_id", cIds);
    if (oErr) console.error("  orders delete:", oErr.message);

    await supabase.from("reminders").delete().in("customer_id", cIds);
  }

  // Now customers can be deleted (cascade addresses, machines)
  const { error: delCustErr } = await supabase
    .from("customers").delete().in("code", codes);
  if (delCustErr) console.error("  customer delete:", delCustErr.message);
  else console.log(`  deleted ${cIds.length} customer(s) + cascades`);

  // Delete demo staff (profile then auth)
  for (const s of STAFF) {
    const u = await findUserByEmail(s.email);
    if (u) {
      await supabase.from("user_profiles").delete().eq("id", u.id);
      const { error } = await supabase.auth.admin.deleteUser(u.id);
      if (error) console.error(`  delete auth user ${s.email}:`, error.message);
      else console.log(`  deleted user: ${s.email}`);
    }
  }
  console.log("Reset complete.\n");
}

async function seedStaff() {
  console.log("Creating staff users...");
  const idByName = new Map();
  for (const s of STAFF) {
    const existing = await findUserByEmail(s.email);
    let userId = existing?.id;
    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: s.email,
        password: "admin1234",
        email_confirm: true,
        user_metadata: { name: s.name },
      });
      if (error) {
        console.error(`  FAILED ${s.email}: ${error.message}`);
        continue;
      }
      userId = data.user.id;
      const { error: pErr } = await supabase.from("user_profiles").insert({
        id: userId, name: s.name, role: s.role, active: true,
      });
      if (pErr) console.error(`  profile insert ${s.email}: ${pErr.message}`);
      console.log(`  + ${s.name.padEnd(8)} ${s.email}  [${s.role}]`);
    } else {
      // Ensure profile exists
      const { data: prof } = await supabase
        .from("user_profiles").select("id").eq("id", userId).maybeSingle();
      if (!prof) {
        await supabase.from("user_profiles").insert({
          id: userId, name: s.name, role: s.role, active: true,
        });
      }
      console.log(`  = ${s.name.padEnd(8)} ${s.email}  [exists]`);
    }
    idByName.set(s.name, userId);
  }
  return idByName;
}

async function seedCustomers(sourceByName) {
  console.log("\nCreating customers + addresses + machines...");
  const ctx = new Map();
  for (const c of CUSTOMERS) {
    const { data: existing } = await supabase
      .from("customers").select("id").eq("code", c.code).maybeSingle();
    let customerId = existing?.id;
    if (!customerId) {
      const { data, error } = await supabase.from("customers").insert({
        code: c.code, name: c.name, phone: c.phone,
        source_id: sourceByName.get(c.source) ?? null,
        note: c.note ?? null,
        joined_at: "2026-01-01",
      }).select("id").single();
      if (error) {
        console.error(`  ${c.code}: ${error.message}`);
        continue;
      }
      customerId = data.id;
      console.log(`  + ${c.code} ${c.name}`);
    } else {
      console.log(`  = ${c.code} ${c.name}  [exists, will reuse]`);
    }

    // Replace addresses & machines (idempotent)
    await supabase.from("customer_addresses").delete().eq("customer_id", customerId);
    const addrIds = [];
    for (const a of c.addresses) {
      const { data } = await supabase.from("customer_addresses").insert({
        customer_id: customerId,
        county: a.county, district: a.district, address: a.address,
        label: a.label ?? null, is_default: !!a.is_default,
      }).select("id").single();
      if (data) addrIds.push(data.id);
    }

    await supabase.from("machines").delete().eq("customer_id", customerId);
    const machineIds = [];
    for (const m of c.machines) {
      const { data } = await supabase.from("machines").insert({
        customer_id: customerId,
        address_id: addrIds[0] ?? null,
        type: m.type,
        brand: m.brand ?? null,
        model: m.model ?? null,
        sub_type: m.sub_type ?? null,
        note: m.note ?? null,
      }).select("id").single();
      if (data) machineIds.push(data.id);
    }
    ctx.set(c.code, { id: customerId, addressIds: addrIds, machineIds });
  }
  return ctx;
}

async function seedOrders(custCtx, techIds, serviceByCode, adjByName) {
  console.log("\nCreating orders + items + adjustments...");

  // Delete existing demo orders (those linked to our demo customers)
  const customerIds = Array.from(custCtx.values()).map((c) => c.id);
  if (customerIds.length > 0) {
    await supabase.from("orders").delete().in("customer_id", customerIds);
  }

  // Group orders by date for sequential order_code numbering
  const counterByDate = new Map();

  let created = 0;
  for (const o of ORDERS) {
    const cust = custCtx.get(o.c);
    if (!cust) continue;
    const dateForCode = o.sched ? new Date(o.sched) : new Date();
    const datePrefix = `${dateForCode.getFullYear()}${pad(dateForCode.getMonth() + 1)}${pad(dateForCode.getDate())}`;
    const seq = (counterByDate.get(datePrefix) ?? 0) + 1;
    counterByDate.set(datePrefix, seq);
    const orderCode = `${datePrefix}-${pad(seq).padStart(3, "0")}`;

    const insertPayload = {
      order_code: orderCode,
      customer_id: cust.id,
      address_id: cust.addressIds[0],
      scheduled_at: o.sched,
      scheduled_end_at: endOf(o.sched, o.items),
      service_at: o.service ?? null,
      status: o.status,
      payment_method: o.pay,
    };
    if (o.settle) insertPayload.settlement_status = o.settle;

    const { data: orderRow, error: oerr } = await supabase
      .from("orders").insert(insertPayload).select("id").single();
    if (oerr || !orderRow) {
      console.error(`  order ${orderCode}: ${oerr?.message}`);
      continue;
    }

    for (const it of o.items) {
      const svc = serviceByCode.get(it.svc);
      if (!svc) continue;
      const mIds = cust.machineIds;
      const machineId = mIds.length ? mIds[created % mIds.length] : null;
      await supabase.from("order_items").insert({
        order_id: orderRow.id,
        service_item_id: svc.id,
        machine_id: machineId,
        technician_id: o.t !== null && o.t !== undefined ? techIds[o.t] : null,
        quantity: 1,
        unit_price: it.price,
        subtotal: it.price,
      });
    }

    if (o.addons) {
      for (const a of o.addons) {
        const master = adjByName.get(a.name);
        await supabase.from("order_adjustments").insert({
          order_id: orderRow.id,
          adjustment_item_id: master?.id ?? null,
          name_snapshot: a.name,
          type: master?.type ?? (a.amount < 0 ? "discount" : "addon"),
          amount: a.amount,
        });
      }
    }
    created++;
  }
  console.log(`  created ${created} orders`);
  return created;
}

async function refreshReminders() {
  console.log("\nGenerating annual reminders...");
  const { data, error } = await supabase.rpc("refresh_annual_reminders");
  if (error) console.error("  rpc error:", error.message);
  else console.log(`  inserted ${data ?? 0} reminder(s)`);
}

async function summary() {
  console.log("\n=== Summary ===");
  const { count: customerCount } = await supabase
    .from("customers").select("*", { count: "exact", head: true });
  const { count: ordersCount } = await supabase
    .from("orders").select("*", { count: "exact", head: true });
  const { data: pending } = await supabase
    .from("orders").select("total")
    .eq("payment_method", "cash").eq("settlement_status", "pending");
  const pendingTotal = (pending ?? []).reduce((s, o) => s + Number(o.total), 0);
  const { count: settledCount } = await supabase
    .from("orders").select("*", { count: "exact", head: true })
    .eq("settlement_status", "settled");
  const { count: remindersCount } = await supabase
    .from("reminders").select("*", { count: "exact", head: true })
    .eq("status", "pending");
  console.log(`Customers          : ${customerCount}`);
  console.log(`Orders             : ${ordersCount}`);
  console.log(`Pending cash       : ${pending?.length ?? 0} orders, NT$${pendingTotal}`);
  console.log(`Settled (回繳完)    : ${settledCount}`);
  console.log(`Pending reminders  : ${remindersCount}`);
}

async function main() {
  console.log("=== Jingxin Laundry CMS - Demo Seed ===");
  if (RESET) await reset();

  const techProfiles = await seedStaff();
  const techIds = STAFF
    .filter((s) => s.role === "technician")
    .map((s) => techProfiles.get(s.name));

  const { data: sources } = await supabase
    .from("customer_sources").select("id, name");
  const sourceByName = new Map((sources ?? []).map((s) => [s.name, s.id]));

  const { data: services } = await supabase
    .from("service_items").select("id, code, name, default_price");
  const serviceByCode = new Map((services ?? []).map((s) => [s.code, s]));

  const { data: adjs } = await supabase
    .from("adjustment_items").select("id, name, type, default_amount");
  const adjByName = new Map((adjs ?? []).map((a) => [a.name, a]));

  const custCtx = await seedCustomers(sourceByName);
  await seedOrders(custCtx, techIds, serviceByCode, adjByName);
  await refreshReminders();
  await summary();

  console.log("\nDemo accounts (password = admin1234):");
  for (const s of STAFF) {
    console.log(`  [${s.role.padEnd(10)}] ${s.email}  (${s.name})`);
  }
  console.log("\nDone.");
}

main().catch((e) => {
  console.error("Fatal:", e);
  process.exit(1);
});
