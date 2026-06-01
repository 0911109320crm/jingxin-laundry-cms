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
const AUDIT_UID = "5a2ae3b2-588b-404b-9ef6-578b1574ad1c";
const FLOOR = "2022-08-11";
const c = new pg.Client({ host: process.env.PGHOST, port: 5432, user: process.env.PGUSER, password: process.env.PGPASSWORD, database: "postgres", ssl: { rejectUnauthorized: false } });
await c.connect();

// 真實總數（postgres = owner，不受 RLS）
const tot = await c.query(`
  select
    (select count(*) from customers) cust_all,
    (select count(*) from customers where (created_at at time zone 'Asia/Taipei')::date >= '${FLOOR}') cust_postfloor,
    (select count(*) from orders) ord_all,
    (select count(*) from orders where (coalesce(service_at,scheduled_at,created_at) at time zone 'Asia/Taipei')::date >= '${FLOOR}') ord_postfloor
`);
console.log("真實(無RLS):", tot.rows[0]);

// 模擬查帳帳號（authenticated role + jwt sub）
await c.query("begin");
await c.query("set local role authenticated");
await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: AUDIT_UID, role: "authenticated" })]);
const seen = await c.query(`
  select
    public.audit_floor() as floor_seen,
    public.is_readonly() as readonly_seen,
    (select count(*) from customers) cust_visible,
    (select count(*) from customers where (created_at at time zone 'Asia/Taipei')::date < '${FLOOR}') cust_prefloor_LEAK,
    (select count(*) from orders) ord_visible,
    (select count(*) from orders where (coalesce(service_at,scheduled_at,created_at) at time zone 'Asia/Taipei')::date < '${FLOOR}') ord_prefloor_LEAK,
    (select count(*) from orders o where not exists (select 1 from customers c where c.id = o.customer_id)) orphan_orders
`);
console.log("查帳帳號可見:", seen.rows[0]);

// 寫入封鎖測試（應該失敗）
let writeBlocked = false;
try {
  await c.query("savepoint sp1");
  await c.query("insert into customers (code, name, phone) values ('AUDITTEST', 't', '0900000000')");
  await c.query("rollback to savepoint sp1");
} catch (e) {
  writeBlocked = true;
  console.log("寫入測試 → 已被擋:", e.message.split("\n")[0]);
}
await c.query("rollback");
await c.end();

const r = seen.rows[0], t = tot.rows[0];
const ok =
  Number(r.ord_visible) === Number(t.ord_postfloor) &&
  Number(r.ord_prefloor_LEAK) === 0 &&
  Number(r.orphan_orders) === 0 &&
  r.floor_seen && r.readonly_seen === true &&
  writeBlocked;
console.log(`\n顧客可見 ${r.cust_visible} / 全部 ${t.cust_all}（成立後訂單或加入日≥成立日才顯示）`);
console.log(ok
  ? "PASS ✅ 訂單只到成立後、無洩漏、無孤兒訂單、寫入被擋"
  : "FAIL ❌ 有問題，請看上面數字");
