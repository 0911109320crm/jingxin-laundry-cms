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

const ownerId = (await c.query("select id from user_profiles where role in ('owner','manager') and coalesce(readonly,false)=false limit 1")).rows[0].id;
const like = "%林%", digits = "%0912%", addrLike = "%中正%";

const queries = {
  "customers(name/phone/code)": `select id from customers where name ilike '${like}' or phone ilike '${like}' or code ilike '${like}' limit 5`,
  "customer_phones(副電話)": `select customer_id from customer_phones where phone ilike '${digits}' and is_primary=false limit 10`,
  "customer_addresses(地址)": `select customer_id from customer_addresses where address ilike '${addrLike}' or district ilike '${addrLike}' limit 10`,
  "orders(code/note/legacy)": `select id from orders where order_code ilike '${like}' or note ilike '${like}' or legacy_code ilike '${like}' limit 8`,
  "machines(code)": `select customer_id from machines where code ilike '${like}' and code is not null limit 10`,
  "order_items(item_code)": `select order_id from order_items where item_code ilike '${like}' limit 5`,
};

async function timeAll(label, asOwner) {
  if (asOwner) {
    await c.query("begin");
    await c.query("set local role authenticated");
    await c.query("select set_config('request.jwt.claims', $1, true)", [JSON.stringify({ sub: ownerId, role: "authenticated" })]);
  }
  console.log(`\n--- ${label} ---`);
  let total = 0;
  for (const [name, sql] of Object.entries(queries)) {
    const t = process.hrtime.bigint();
    await c.query(sql);
    const ms = Number(process.hrtime.bigint() - t) / 1e6;
    total += ms;
    console.log(`  ${ms.toFixed(0).padStart(5)}ms  ${name}`);
  }
  console.log(`  TOTAL(序列) ${total.toFixed(0)}ms`);
  if (asOwner) await c.query("rollback");
}

await timeAll("postgres(無RLS)", false);
await timeAll("owner(套RLS)", true);
await c.end();
console.log("\nDONE");
