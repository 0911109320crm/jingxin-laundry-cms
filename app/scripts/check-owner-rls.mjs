import pg from "pg";
import { readFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve } from "node:path";
const __dirname = dirname(fileURLToPath(import.meta.url));
for (const line of readFileSync(resolve(__dirname, "..", ".env.migrate"), "utf-8").split(/\r?\n/)) {
  if (!line || line.startsWith("#") || !line.includes("=")) continue;
  const i = line.indexOf("="); const k = line.slice(0, i).trim();
  if (!(k in process.env)) process.env[k] = line.slice(i + 1).trim();
}
const c = new pg.Client({ host: process.env.PGHOST, port: 5432, user: process.env.PGUSER, password: process.env.PGPASSWORD, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();

// 真實(無RLS)排案數
const raw = await c.query("select count(*) c from orders where status='scheduled' and scheduled_at is not null");
console.log("真實已排案(scheduled+有日期):", raw.rows[0].c);

// 找一個 owner / manager 帳號(非 readonly)模擬
const owner = await c.query("select id, name, role, readonly, data_floor_date from user_profiles where role in ('owner','manager') and coalesce(readonly,false)=false order by role limit 1");
const o = owner.rows[0];
console.log("模擬帳號:", o.name, o.role, "readonly=", o.readonly, "floor=", o.data_floor_date);

await c.query("begin");
await c.query("set local role authenticated");
await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: o.id, role: "authenticated" })]);
const seen = await c.query("select public.audit_floor() floor, count(*) c from orders where status='scheduled' and scheduled_at is not null");
console.log("該帳號(RLS)看到的已排案:", seen.rows[0].c, " audit_floor()=", seen.rows[0].floor);
// 也測一般 select orders 總數
const allSeen = await c.query("select count(*) c from orders");
const allRaw0 = await c.query("select 1");
await c.query("rollback");
const allRaw = await c.query("select count(*) c from orders");
console.log("該帳號(RLS)看到的 orders 總數:", allSeen.rows[0].c, " / 真實總數:", allRaw.rows[0].c);
await c.end();
console.log(Number(seen.rows[0].c) === Number(raw.rows[0].c) ? "\nPASS ✅ owner/manager 看得到全部已排案，RLS 沒擋" : "\nFAIL ❌ RLS 擋掉了已排案！");
