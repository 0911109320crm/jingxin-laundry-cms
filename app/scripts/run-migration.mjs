#!/usr/bin/env node
// 跑 migration / 任意 SQL，連線設定讀自 gitignored 的 app/.env.migrate。
// 用法：
//   node scripts/run-migration.mjs supabase/migrations/0029_xxx.sql
//   node scripts/run-migration.mjs -c "select enum_range(null::machine_type)"
import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));

// 載入 .env.migrate（不覆寫已存在的環境變數）
try {
  const txt = readFileSync(resolve(__dirname, "..", ".env.migrate"), "utf-8");
  for (const line of txt.split(/\r?\n/)) {
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const i = line.indexOf("=");
    const k = line.slice(0, i).trim();
    const v = line.slice(i + 1).trim();
    if (!(k in process.env)) process.env[k] = v;
  }
} catch {
  console.error("找不到 app/.env.migrate（DB 連線設定）。"); process.exit(1);
}

const args = process.argv.slice(2);
let sql;
if (args[0] === "-c") {
  sql = args.slice(1).join(" ");
} else if (args[0]) {
  sql = readFileSync(resolve(process.cwd(), args[0]), "utf-8");
} else {
  console.error("用法：run-migration.mjs <file.sql> | -c \"SQL\""); process.exit(1);
}

const client = new pg.Client({
  host: process.env.PGHOST,
  port: Number(process.env.PGPORT || 5432),
  user: process.env.PGUSER,
  password: process.env.PGPASSWORD,
  database: process.env.PGDATABASE || "postgres",
  ssl: { rejectUnauthorized: false },
  connectionTimeoutMillis: 15000,
});

try {
  await client.connect();
  const res = await client.query(sql);
  const rows = Array.isArray(res) ? res.flatMap((r) => r.rows ?? []) : res.rows ?? [];
  console.log("OK 執行成功" + (rows.length ? `；回傳 ${rows.length} 列：` : ""));
  if (rows.length) console.dir(rows, { depth: 4 });
  await client.end();
} catch (e) {
  console.error(`FAIL ${e.code || ""} ${e.message}`);
  try { await client.end(); } catch {}
  process.exit(1);
}
