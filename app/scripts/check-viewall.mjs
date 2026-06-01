import { createClient } from "@supabase/supabase-js";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8").split(/\r?\n/).filter(l => l && !l.startsWith("#") && l.includes("=")).map(l => { const i = l.indexOf("="); return [l.slice(0, i).trim(), l.slice(i + 1).trim()]; }));
const s = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, { auth: { persistSession: false } });

const { data: techs } = await s.from("user_profiles").select("id,name").eq("active", true).eq("role", "technician").order("name");
const startWindow = new Date(); startWindow.setDate(startWindow.getDate() - 7);
const { data: ordersRaw, error } = await s.from("orders")
  .select(`id, scheduled_at, status, customer:customers(name), address:customer_addresses(county,district), items:order_items(technician_id, service:service_items(name))`)
  .not("scheduled_at", "is", null).neq("status", "cancelled").gte("scheduled_at", startWindow.toISOString()).order("scheduled_at");
if (error) { console.log("QUERY FAIL:", error.message); process.exit(1); }
console.log(`近期(非取消、有排程)訂單共 ${ordersRaw.length} 筆`);
for (const t of techs) {
  const n = (ordersRaw ?? []).filter(o => (o.items ?? []).some(it => it.technician_id === t.id)).length;
  console.log(`  ${t.name}: ${n} 件近期排班`);
}
console.log("OK 資料路徑正常");
