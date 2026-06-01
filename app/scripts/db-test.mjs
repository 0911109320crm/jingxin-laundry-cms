import pg from "pg";
const HOST = process.env.DBHOST;
const USER = process.env.DBUSER || "postgres";
const PORT = Number(process.env.DBPORT || 5432);
const candidates = [process.env.PW1, process.env.PW2].filter(Boolean);

for (const pw of candidates) {
  const masked = pw.slice(0, 2) + "***" + pw.slice(-2);
  const client = new pg.Client({
    host: HOST,
    port: PORT,
    user: USER,
    password: pw,
    database: "postgres",
    ssl: { rejectUnauthorized: false },
    connectionTimeoutMillis: 8000,
  });
  try {
    await client.connect();
    const r = await client.query("select current_user, current_database()");
    console.log(`OK  password [${masked}] → connected as ${r.rows[0].current_user}/${r.rows[0].current_database}`);
    await client.end();
  } catch (e) {
    console.log(`FAIL password [${masked}] → ${e.code || ""} ${e.message}`);
    try { await client.end(); } catch {}
  }
}
console.log("DONE");
