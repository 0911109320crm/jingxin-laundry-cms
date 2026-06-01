import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8").split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("=")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });
const tag = "ZZTESTMERGE" + Math.floor(Math.random() * 1e6);

let custId, addrKeep, addrDup, orderId;
try {
  custId = (await s.from("customers").insert({ code: tag, name: "測試合併", phone: "0900000000" }).select("id").single()).data.id;
  addrKeep = (await s.from("customer_addresses").insert({ customer_id: custId, county: "彰化縣", district: "員林市", address: "建國路204號", is_default: true }).select("id").single()).data.id;
  addrDup = (await s.from("customer_addresses").insert({ customer_id: custId, county: "彰化縣", district: "員林", address: "建國路204號", is_default: false }).select("id").single()).data.id;
  orderId = (await s.from("orders").insert({ order_code: tag + "-O", customer_id: custId, address_id: addrDup, status: "pending" }).select("id").single()).data.id;
  console.log("建立測試資料 OK：訂單掛在重複地址(addrDup)");

  // ── 模擬 mergeAddressesAction 的 DB 操作（把 addrDup 併入 addrKeep）──
  await s.from("orders").update({ address_id: addrKeep }).in("address_id", [addrDup]);
  await s.from("machines").update({ address_id: addrKeep }).in("address_id", [addrDup]);
  await s.from("customer_addresses").update({ merged_into_id: addrKeep, merged_at: new Date().toISOString() }).in("id", [addrDup]);

  const o = (await s.from("orders").select("address_id").eq("id", orderId).single()).data;
  const d = (await s.from("customer_addresses").select("merged_into_id").eq("id", addrDup).single()).data;
  console.log("訂單改指到保留地址:", o.address_id === addrKeep ? "✅" : "❌");
  console.log("重複地址被軟刪除(merged_into_id=保留):", d.merged_into_id === addrKeep ? "✅" : "❌");
} catch (e) {
  console.log("ERROR:", e.message);
} finally {
  // 清理測試資料
  if (orderId) await s.from("orders").delete().eq("id", orderId);
  if (custId) {
    await s.from("customer_addresses").delete().eq("customer_id", custId);
    await s.from("customers").delete().eq("id", custId);
  }
  console.log("測試資料已清除");
}
