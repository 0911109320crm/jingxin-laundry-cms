#!/usr/bin/env node
/**
 * Demo seed for Jingxin Laundry CMS  (expanded — ~300 orders / 6 months)
 *
 * Usage:
 *   node scripts/seed-demo.mjs           - insert demo data
 *   node scripts/seed-demo.mjs --reset   - wipe existing demo data, then re-insert
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
    .map((l) => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim()]; })
);

const supabase = createClient(
  env.NEXT_PUBLIC_SUPABASE_URL,
  env.SUPABASE_SERVICE_ROLE_KEY,
  { auth: { autoRefreshToken: false, persistSession: false } }
);

const RESET = process.argv.includes("--reset");

// ─── Staff ────────────────────────────────────────────────────────────────────
const STAFF = [
  { email: "borenchang+wang@gmail.com",    name: "王大哥",     role: "technician" },
  { email: "borenchang+lin@gmail.com",     name: "林師傅",     role: "technician" },
  { email: "borenchang+chen@gmail.com",    name: "陳師傅",     role: "technician" },
  { email: "borenchang+huang@gmail.com",   name: "黃師傅",     role: "technician" },
  { email: "borenchang+manager@gmail.com", name: "老闆娘助理", role: "manager"    },
];

// ─── Customers ────────────────────────────────────────────────────────────────
const CUSTOMERS = [
  // ── 主力客戶 ──────────────────────────────────────────────────────────────
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

  // ── 新增客戶 C2026-020 ~ C2026-025 ───────────────────────────────────────
  { code: "C2026-020", name: "馮太太", phone: "0912340020", source: "LINE",
    addresses: [{ county: "彰化縣", district: "彰化市", address: "中山路一段200號", is_default: true }],
    machines: [
      { type: "washing_machine", brand: "日立", model: "BD-W90MSP", sub_type: "滾筒式" },
      { type: "air_conditioner", brand: "LG", model: "LSN09DHPD", sub_type: "分離式" }] },

  { code: "C2026-021", name: "葉先生", phone: "0912340021", source: "Google",
    note: "透天厝，機器在頂樓",
    addresses: [{ county: "台中市", district: "豐原區", address: "中正路三段100號", is_default: true }],
    machines: [
      { type: "washing_machine", brand: "Panasonic", model: "NA-V130LB", sub_type: "滾筒式" },
      { type: "mattress", sub_type: "雙人加大" }] },

  { code: "C2026-022", name: "謝阿嬤", phone: "0912340022", source: "老客介紹",
    addresses: [{ county: "彰化縣", district: "二林鎮", address: "南平路120號", is_default: true }],
    machines: [{ type: "washing_machine", brand: "三洋", model: "ASW-88HTB", sub_type: "直立式" }] },

  { code: "C2026-023", name: "江先生", phone: "0912340023", source: "Facebook",
    addresses: [{ county: "台中市", district: "烏日區", address: "中山路一段50號", is_default: true }],
    machines: [{ type: "air_conditioner", brand: "大金", model: "RXM28SVLT", sub_type: "分離式" }] },

  { code: "C2026-024", name: "徐小姐", phone: "0912340024", source: "LINE",
    note: "養貓，沙發多貓毛",
    addresses: [{ county: "南投縣", district: "竹山鎮", address: "延平路80號", is_default: true }],
    machines: [{ type: "sofa", sub_type: "L型沙發", note: "布面，有貓抓痕" }] },

  { code: "C2026-025", name: "曾老師", phone: "0912340025", source: "關鍵電話",
    addresses: [{ county: "雲林縣", district: "西螺鎮", address: "中正路300號", is_default: true }],
    machines: [{ type: "washing_machine", brand: "Whirlpool", model: "WWEB10701BW", sub_type: "滾筒式" }] },

  // ── 沉睡客戶（11-13 個月前，觸發即將到期提醒）────────────────────────────
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

// ─── Service map per customer (code → [[svcCode, price], …]) ─────────────────
const CUST_SVCS = {
  "C2026-001": [["A", 1800]],
  "C2026-002": [["A", 1800], ["C", 2500], ["E", 2400]],
  "C2026-003": [["B", 3800]],
  "C2026-004": [["B", 3800], ["C", 2500]],
  "C2026-005": [["D", 2000]],
  "C2026-006": [["C", 2500], ["E", 2400]],
  "C2026-007": [["A", 1800]],
  "C2026-008": [["B", 3800]],
  "C2026-009": [["A", 1800], ["D", 2000]],
  "C2026-010": [["A", 1800]],
  "C2026-011": [["C", 2500]],
  "C2026-012": [["E", 2400]],
  "C2026-013": [["A", 1800]],
  "C2026-014": [["B", 3800], ["D", 2000]],
  "C2026-015": [["B", 3800]],
  "C2026-020": [["B", 3800], ["C", 2500]],
  "C2026-021": [["B", 3800], ["D", 2000]],
  "C2026-022": [["A", 1800]],
  "C2026-023": [["C", 2500]],
  "C2026-024": [["E", 2400]],
  "C2026-025": [["B", 3800]],
};

const ACTIVE_CODES = Object.keys(CUST_SVCS);

const CANCEL_REASONS = [
  "客戶臨時有事，改期",
  "當日下雨，客戶取消",
  "師傅請假，無法出門",
  "客戶說機器暫時不洗了",
  "客戶忘記預約，人不在家",
  "客戶自行處理，不需服務",
  "客戶出差，無法配合時間",
];

// ─── Deterministic PRNG (mulberry32) ─────────────────────────────────────────
function makePrng(seed) {
  let s = seed | 0;
  return function () {
    s = (s + 0x6D2B79F5) | 0;
    let t = Math.imul(s ^ (s >>> 15), 1 | s);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function pickPay(r) {
  const x = r() * 100;
  if (x < 55) return "cash";
  if (x < 88) return "transfer";
  if (x < 94) return "card";
  return "line_pay";
}

function settlementForCash(ageDays, r) {
  if (ageDays >= 60) return r() < 0.95 ? "settled" : "pending";
  if (ageDays >= 14) return r() < 0.75 ? "settled" : "pending";
  if (ageDays >= 7)  return r() < 0.45 ? "settled" : "pending";
  return "pending";
}

// ─── Programmatic past order generation ──────────────────────────────────────
function generatePastOrders() {
  const orders = [];
  const today = new Date();
  today.setHours(0, 0, 0, 0);

  for (let d = -180; d <= -1; d++) {
    const date = new Date(today);
    date.setDate(date.getDate() + d);
    const dow = date.getDay(); // 0=Sun, 6=Sat
    const isWeekend = dow === 0 || dow === 6;

    const rDay = makePrng(d + 77777);
    const numOrders = isWeekend
      ? (rDay() < 0.22 ? 1 : 0)
      : rDay() < 0.38 ? 3 : 2;

    for (let i = 0; i < numOrders; i++) {
      const r = makePrng(d * 53 + i * 1009 + 31337);

      // Rotate customers deterministically
      const custCode = ACTIVE_CODES[(Math.abs(d) * 17 + i * 11) % ACTIVE_CODES.length];
      const techIdx = (Math.abs(d) * 3 + i * 7) % 4;
      const hour = 8 + Math.floor(r() * 8); // 8:00 – 15:00
      const min = r() < 0.5 ? 0 : 30;

      const sched = new Date(date);
      sched.setHours(hour, min, 0, 0);

      const isCancelled = d < -7 && r() < 0.10;
      const payMethod = isCancelled && r() < 0.6 ? "unpaid" : pickPay(r);

      // Build items (25% chance of multi-service for customers who have >1)
      const svcs = CUST_SVCS[custCode] || [["A", 1800]];
      const useMulti = svcs.length > 1 && r() < 0.25;
      const items = (useMulti ? svcs.slice(0, 2) : svcs.slice(0, 1))
        .map(([svc, price]) => ({ svc, price }));

      // Add-ons: 18% addon, 5% discount
      const addons = [];
      const addonRoll = r();
      if (!isCancelled && addonRoll < 0.18) {
        addons.push({ name: "加大", amount: 200 + Math.floor(r() * 3) * 100 });
      } else if (!isCancelled && addonRoll < 0.23) {
        addons.push({ name: "折扣", amount: 200 });
      }

      const order = {
        c: custCode,
        sched: sched.toISOString(),
        service: isCancelled ? null : sched.toISOString(),
        t: techIdx,
        status: isCancelled ? "cancelled" : "done",
        pay: isCancelled ? "unpaid" : payMethod,
        items,
        ...(addons.length > 0 ? { addons } : {}),
      };

      if (!isCancelled && payMethod === "cash") {
        order.settle = settlementForCash(-d, r);
      }

      if (isCancelled) {
        order.cancel_reason = CANCEL_REASONS[Math.floor(r() * CANCEL_REASONS.length)];
        order.cancelled_at = sched.toISOString();
        delete order.service;
      }

      orders.push(order);
    }
  }
  return orders;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────
function pad(n) { return String(n).padStart(2, "0"); }

function dayOffset(daysFromToday, hour = 10, minute = 0) {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  d.setDate(d.getDate() + daysFromToday);
  d.setHours(hour, minute, 0, 0);
  return d.toISOString();
}

function estimateMinutes(items) {
  let max = 60;
  for (const it of items) {
    const dur = { C: 180, B: 150, E: 120, D: 90, A: 90 }[it.svc] ?? 90;
    if (dur > max) max = dur;
  }
  return max + (items.length - 1) * 30;
}

function endOf(startIso, items) {
  if (!startIso) return null;
  const d = new Date(startIso);
  d.setMinutes(d.getMinutes() + estimateMinutes(items));
  return d.toISOString();
}

// ─── Static orders (sleeping customers + today/future) ─────────────────────
const STATIC_ORDERS = [
  // 沉睡客戶（觸發 annual reminders）
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

  // 今日案件 —— in_progress + scheduled（儀表板 / 月曆 demo 用）
  { c: "C2026-002", sched: dayOffset(0, 9),  t: 0, status: "in_progress", pay: "unpaid",
    items: [{ svc: "A", price: 1800 }, { svc: "C", price: 2500 }] },
  { c: "C2026-012", sched: dayOffset(0, 11), t: 1, status: "in_progress", pay: "unpaid",
    items: [{ svc: "E", price: 2400 }] },
  { c: "C2026-006", sched: dayOffset(0, 14), t: 0, status: "scheduled",   pay: "transfer",
    items: [{ svc: "C", price: 2500 }, { svc: "E", price: 2400 }] },
  { c: "C2026-021", sched: dayOffset(0, 15), t: 2, status: "scheduled",   pay: "unpaid",
    items: [{ svc: "B", price: 3800 }, { svc: "D", price: 2000 }] },

  // 明天 + 近一週
  { c: "C2026-004", sched: dayOffset(1, 10),  t: 3, status: "scheduled", pay: "unpaid",
    items: [{ svc: "B", price: 3800 }, { svc: "C", price: 2500 }] },
  { c: "C2026-015", sched: dayOffset(1, 14),  t: 1, status: "scheduled", pay: "unpaid",
    items: [{ svc: "B", price: 3800 }] },
  { c: "C2026-009", sched: dayOffset(2, 9),   t: 0, status: "scheduled", pay: "transfer",
    items: [{ svc: "A", price: 1800 }, { svc: "D", price: 2000 }] },
  { c: "C2026-003", sched: dayOffset(2, 14),  t: 2, status: "scheduled", pay: "unpaid",
    items: [{ svc: "B", price: 3800 }] },
  { c: "C2026-020", sched: dayOffset(3, 9),   t: 1, status: "scheduled", pay: "unpaid",
    items: [{ svc: "B", price: 3800 }, { svc: "C", price: 2500 }] },
  { c: "C2026-023", sched: dayOffset(3, 14),  t: 3, status: "scheduled", pay: "line_pay",
    items: [{ svc: "C", price: 2500 }] },
  { c: "C2026-001", sched: dayOffset(4, 10),  t: 0, status: "scheduled", pay: "unpaid",
    items: [{ svc: "A", price: 1800 }] },
  { c: "C2026-008", sched: dayOffset(5, 14),  t: 3, status: "scheduled", pay: "cash",
    items: [{ svc: "B", price: 3800 }] },
  { c: "C2026-005", sched: dayOffset(6, 10),  t: 1, status: "scheduled", pay: "unpaid",
    items: [{ svc: "D", price: 2000 }] },
  { c: "C2026-013", sched: dayOffset(7, 9),   t: 2, status: "scheduled", pay: "unpaid",
    items: [{ svc: "A", price: 1800 }] },
  { c: "C2026-014", sched: dayOffset(8, 14),  t: 0, status: "scheduled", pay: "transfer",
    items: [{ svc: "B", price: 3800 }, { svc: "D", price: 2000 }] },
  { c: "C2026-024", sched: dayOffset(9, 10),  t: 1, status: "scheduled", pay: "unpaid",
    items: [{ svc: "E", price: 2400 }] },
  { c: "C2026-022", sched: dayOffset(10, 14), t: 2, status: "scheduled", pay: "unpaid",
    items: [{ svc: "A", price: 1800 }] },
  { c: "C2026-011", sched: dayOffset(11, 9),  t: 3, status: "scheduled", pay: "unpaid",
    items: [{ svc: "C", price: 2500 }] },
  { c: "C2026-007", sched: dayOffset(12, 10), t: 0, status: "scheduled", pay: "cash",
    items: [{ svc: "A", price: 1800 }],
    addons: [{ name: "加大", amount: 200 }] },
  { c: "C2026-025", sched: dayOffset(14, 14), t: 1, status: "scheduled", pay: "transfer",
    items: [{ svc: "B", price: 3800 }] },

  // 待派工（pending，左側面板 demo 用）
  { c: "C2026-006", sched: null, t: null, status: "pending", pay: "unpaid",
    items: [{ svc: "C", price: 2500 }] },
  { c: "C2026-010", sched: null, t: null, status: "pending", pay: "unpaid",
    items: [{ svc: "A", price: 1800 }, { svc: "D", price: 2000 }] },
  { c: "C2026-002", sched: null, t: null, status: "pending", pay: "transfer",
    items: [{ svc: "E", price: 2400 }] },
  { c: "C2026-021", sched: null, t: null, status: "pending", pay: "unpaid",
    items: [{ svc: "B", price: 3800 }] },
];

// ─── Full order list ──────────────────────────────────────────────────────────
const ORDERS = [...generatePastOrders(), ...STATIC_ORDERS];

// ─── Auth helpers ─────────────────────────────────────────────────────────────
async function listAllAuthUsers() {
  const { data } = await supabase.auth.admin.listUsers({ perPage: 200 });
  return data?.users ?? [];
}
async function findUserByEmail(email) {
  const users = await listAllAuthUsers();
  return users.find((u) => u.email === email) ?? null;
}

// ─── Reset ────────────────────────────────────────────────────────────────────
async function reset() {
  console.log("Reset mode: deleting demo data...");
  const codes = CUSTOMERS.map((c) => c.code);
  const { data: existingCustomers } = await supabase
    .from("customers").select("id").in("code", codes);
  const cIds = (existingCustomers ?? []).map((c) => c.id);
  if (cIds.length > 0) {
    const { error: oErr } = await supabase.from("orders").delete().in("customer_id", cIds);
    if (oErr) console.error("  orders delete:", oErr.message);
    await supabase.from("reminders").delete().in("customer_id", cIds);
  }
  const { error: delCustErr } = await supabase.from("customers").delete().in("code", codes);
  if (delCustErr) console.error("  customer delete:", delCustErr.message);
  else console.log(`  deleted ${cIds.length} customer(s) + cascades`);
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

// ─── Seed staff ───────────────────────────────────────────────────────────────
async function seedStaff() {
  console.log("Creating staff users...");
  const idByName = new Map();
  for (const s of STAFF) {
    const existing = await findUserByEmail(s.email);
    let userId = existing?.id;
    if (!userId) {
      const { data, error } = await supabase.auth.admin.createUser({
        email: s.email, password: "admin1234", email_confirm: true,
        user_metadata: { name: s.name },
      });
      if (error) { console.error(`  FAILED ${s.email}: ${error.message}`); continue; }
      userId = data.user.id;
      const { error: pErr } = await supabase.from("user_profiles").insert(
        { id: userId, name: s.name, role: s.role, active: true }
      );
      if (pErr) console.error(`  profile insert ${s.email}: ${pErr.message}`);
      console.log(`  + ${s.name.padEnd(8)} ${s.email}  [${s.role}]`);
    } else {
      const { data: prof } = await supabase.from("user_profiles").select("id").eq("id", userId).maybeSingle();
      if (!prof) {
        await supabase.from("user_profiles").insert({ id: userId, name: s.name, role: s.role, active: true });
      }
      console.log(`  = ${s.name.padEnd(8)} ${s.email}  [exists]`);
    }
    idByName.set(s.name, userId);
  }
  return idByName;
}

// ─── Seed customers ───────────────────────────────────────────────────────────
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
        joined_at: "2025-12-01",
      }).select("id").single();
      if (error) { console.error(`  ${c.code}: ${error.message}`); continue; }
      customerId = data.id;
      console.log(`  + ${c.code} ${c.name}`);
    } else {
      console.log(`  = ${c.code} ${c.name}  [exists]`);
    }
    await supabase.from("customer_addresses").delete().eq("customer_id", customerId);
    const addrIds = [];
    for (const a of c.addresses) {
      const { data } = await supabase.from("customer_addresses").insert({
        customer_id: customerId, county: a.county, district: a.district,
        address: a.address, label: a.label ?? null, is_default: !!a.is_default,
      }).select("id").single();
      if (data) addrIds.push(data.id);
    }
    await supabase.from("machines").delete().eq("customer_id", customerId);
    const machineIds = [];
    for (const m of c.machines) {
      const { data } = await supabase.from("machines").insert({
        customer_id: customerId, address_id: addrIds[0] ?? null,
        type: m.type, brand: m.brand ?? null, model: m.model ?? null,
        sub_type: m.sub_type ?? null, note: m.note ?? null,
      }).select("id").single();
      if (data) machineIds.push(data.id);
    }
    ctx.set(c.code, { id: customerId, addressIds: addrIds, machineIds });
  }
  return ctx;
}

// ─── Seed orders ──────────────────────────────────────────────────────────────
async function seedOrders(custCtx, techIds, serviceByCode, adjByName) {
  console.log(`\nCreating ${ORDERS.length} orders...`);
  const customerIds = Array.from(custCtx.values()).map((c) => c.id);
  if (customerIds.length > 0) {
    await supabase.from("orders").delete().in("customer_id", customerIds);
  }

  const counterByDate = new Map();
  let created = 0;

  for (const o of ORDERS) {
    const cust = custCtx.get(o.c);
    if (!cust) continue;
    const dateForCode = o.sched ? new Date(o.sched) : new Date();
    const datePrefix = `${dateForCode.getFullYear()}${pad(dateForCode.getMonth() + 1)}${pad(dateForCode.getDate())}`;
    const seq = (counterByDate.get(datePrefix) ?? 0) + 1;
    counterByDate.set(datePrefix, seq);
    const orderCode = `${datePrefix}-${String(seq).padStart(3, "0")}`;

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
    if (o.cancel_reason) {
      insertPayload.cancellation_reason = o.cancel_reason;
      insertPayload.cancelled_at = o.cancelled_at ?? o.sched;
    }

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
        technician_id: (o.t !== null && o.t !== undefined) ? techIds[o.t] : null,
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
    if (created % 50 === 0) process.stdout.write(`  ... ${created} done\r`);
  }
  console.log(`  created ${created} orders               `);
  return created;
}

// ─── Reminders ────────────────────────────────────────────────────────────────
async function refreshReminders() {
  console.log("\nGenerating annual reminders...");
  const { data, error } = await supabase.rpc("refresh_annual_reminders");
  if (error) console.error("  rpc error:", error.message);
  else console.log(`  inserted ${data ?? 0} reminder(s)`);
}

// ─── Summary ──────────────────────────────────────────────────────────────────
async function summary() {
  console.log("\n=== Summary ===");
  const { count: customerCount } = await supabase
    .from("customers").select("*", { count: "exact", head: true });
  const { count: ordersCount } = await supabase
    .from("orders").select("*", { count: "exact", head: true });
  const { count: doneCount } = await supabase
    .from("orders").select("*", { count: "exact", head: true }).eq("status", "done");
  const { count: cancelCount } = await supabase
    .from("orders").select("*", { count: "exact", head: true }).eq("status", "cancelled");
  const { data: pending } = await supabase
    .from("orders").select("total")
    .eq("payment_method", "cash").eq("settlement_status", "pending");
  const pendingTotal = (pending ?? []).reduce((s, o) => s + Number(o.total), 0);
  const { count: remindersCount } = await supabase
    .from("reminders").select("*", { count: "exact", head: true }).eq("status", "pending");
  console.log(`客戶總數          : ${customerCount}`);
  console.log(`訂單總數          : ${ordersCount}`);
  console.log(`  已完成          : ${doneCount}`);
  console.log(`  已取消          : ${cancelCount}`);
  console.log(`待回繳現金        : ${pending?.length ?? 0} 筆，NT$${pendingTotal.toLocaleString()}`);
  console.log(`即將到期提醒      : ${remindersCount} 筆`);
}

// ─── Main ─────────────────────────────────────────────────────────────────────
async function main() {
  console.log("=== 淨新洗衣 CMS - Demo Seed (expanded) ===");
  console.log(`計畫寫入 ${ORDERS.length} 筆訂單 / ${CUSTOMERS.length} 位客戶\n`);

  if (RESET) await reset();

  const techProfiles = await seedStaff();
  const techIds = STAFF.filter((s) => s.role === "technician").map((s) => techProfiles.get(s.name));

  const { data: sources } = await supabase.from("customer_sources").select("id, name");
  const sourceByName = new Map((sources ?? []).map((s) => [s.name, s.id]));

  const { data: services } = await supabase.from("service_items").select("id, code, name, default_price");
  const serviceByCode = new Map((services ?? []).map((s) => [s.code, s]));

  const { data: adjs } = await supabase.from("adjustment_items").select("id, name, type, default_amount");
  const adjByName = new Map((adjs ?? []).map((a) => [a.name, a]));

  const custCtx = await seedCustomers(sourceByName);
  await seedOrders(custCtx, techIds, serviceByCode, adjByName);
  await refreshReminders();
  await summary();

  console.log("\nDemo accounts (password = admin1234):");
  for (const s of STAFF) console.log(`  [${s.role.padEnd(10)}] ${s.email}  (${s.name})`);
  console.log("\nDone.");
}

main().catch((e) => { console.error("Fatal:", e); process.exit(1); });
