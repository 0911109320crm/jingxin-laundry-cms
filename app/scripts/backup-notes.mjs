#!/usr/bin/env node
/**
 * 備份所有「匯入自 」開頭的 orders.note，存成本機 JSON（清洗前快照，可回滾）
 */
import { createClient } from "@supabase/supabase-js";
import { readFileSync, writeFileSync, mkdirSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const env = Object.fromEntries(
  readFileSync(resolve(__dirname, "..", ".env.local"), "utf-8")
    .split(/\r?\n/)
    .filter((l) => l && !l.startsWith("#") && l.includes("="))
    .map((l) => { const [k, ...r] = l.split("="); return [k.trim(), r.join("=").trim()]; })
);
const supabase = createClient(env.NEXT_PUBLIC_SUPABASE_URL, env.SUPABASE_SERVICE_ROLE_KEY, {
  auth: { autoRefreshToken: false, persistSession: false },
});

const all = [];
const PAGE = 1000;
for (let from = 0; ; from += PAGE) {
  const { data, error } = await supabase
    .from("orders").select("id, note")
    .like("note", "匯入自 %")
    .order("id")
    .range(from, from + PAGE - 1);
  if (error) { console.error(error); process.exit(1); }
  if (!data.length) break;
  all.push(...data);
  if (data.length < PAGE) break;
}

const dir = resolve(__dirname, "..", ".backups");
mkdirSync(dir, { recursive: true });
const out = resolve(dir, "orders-note-before-cleanup.json");
writeFileSync(out, JSON.stringify(all), "utf-8");
console.log(`backed up ${all.length} notes -> ${out}`);
