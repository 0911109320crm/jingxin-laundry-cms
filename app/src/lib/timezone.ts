/**
 * 全站時區工具 —— 一律鎖定台灣 (Asia/Taipei, 固定 UTC+8, 無日光節約)。
 *
 * 為什麼需要這支：
 *   - DB 的 scheduled_at / service_at 是 timestamptz，存的是 UTC 瞬間。
 *   - 系統部署在 Vercel，server 執行環境時區是 UTC。
 *   - 絕不可用 `new Date(iso).getHours()` / `.getDate()` 來「顯示」或「填回表單」，
 *     因為那會跟著執行環境時區跑：在 UTC server 上 11:00(台灣) 會變成 03:00。
 *   - 也不可用 `new Date("2025-06-09T11:00")`（無時區字串）來「解析」表單輸入，
 *     因為那會跟著瀏覽器時區跑：師傅人在國外就會存錯。
 *
 * 規則：凡是 ISO ↔ 台灣本地字串 的轉換，一律走這支，明確指定 +08:00 / Asia/Taipei，
 * 不依賴 server 或瀏覽器的當地時區。
 */

const TAIPEI_TZ = "Asia/Taipei";
/** 台灣固定 UTC+8（無 DST），可安全寫死偏移量。 */
const TAIPEI_OFFSET = "+08:00";

/** 內部：把一個 Date 用台灣時區拆成數字零件。 */
function taipeiParts(d: Date) {
  // sv-SE 輸出 ISO 風格 "YYYY-MM-DD HH:mm:ss"，再自行切割成零件。
  const fmt = new Intl.DateTimeFormat("sv-SE", {
    timeZone: TAIPEI_TZ,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    second: "2-digit",
    hour12: false,
  });
  const parts = fmt.formatToParts(d);
  const get = (t: string) => parts.find((p) => p.type === t)?.value ?? "";
  let hour = get("hour");
  if (hour === "24") hour = "00"; // sv-SE 偶爾把午夜輸出成 24
  return {
    year: get("year"),
    month: get("month"),
    day: get("day"),
    hour,
    minute: get("minute"),
  };
}

/**
 * timestamptz ISO（或任何 Date 可解析字串）→ 台灣本地 "YYYY-MM-DDTHH:mm"，
 * 供 <input type="datetime-local"> / DateTimeSelect 預填。
 * server / client 結果一致（都用 Asia/Taipei，不看執行環境時區）。
 */
export function isoToTaipeiInput(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = taipeiParts(d);
  return `${p.year}-${p.month}-${p.day}T${p.hour}:${p.minute}`;
}

/**
 * 台灣本地 "YYYY-MM-DDTHH:mm"（DateTimeSelect 產出）→ UTC ISO，供存入 timestamptz。
 * 明確當作 +08:00 解析，不依賴瀏覽器時區。
 * 若字串已含時區（Z 或 ±hh:mm）則原樣回傳。
 */
export function taipeiInputToIso(local: string | null | undefined): string | null {
  if (!local) return null;
  if (/Z$|[+-]\d{2}:?\d{2}$/.test(local)) return local; // 已含時區
  const m = local.match(/^(\d{4}-\d{2}-\d{2})T(\d{2}):(\d{2})/);
  if (!m) {
    // 非預期格式，盡力解析（仍鎖 +08:00）
    const d = new Date(`${local}${TAIPEI_OFFSET}`);
    return Number.isNaN(d.getTime()) ? null : d.toISOString();
  }
  const d = new Date(`${m[1]}T${m[2]}:${m[3]}:00${TAIPEI_OFFSET}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}

/** timestamptz ISO → 台灣 "HH:mm"（24 小時制），供時段顯示。 */
export function formatTaipeiTime(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = taipeiParts(d);
  return `${p.hour}:${p.minute}`;
}

/** timestamptz ISO → 台灣 "YYYY-MM-DD"（供分日歸屬/分組，不看執行環境時區）。 */
export function taipeiDateStr(iso: string | null | undefined): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  const p = taipeiParts(d);
  return `${p.year}-${p.month}-${p.day}`;
}

/**
 * "YYYY-MM" → 該月在台灣時區的 UTC 起訖 ISO（半開區間 [start, end)）。
 * 用於用 timestamptz 欄位篩「某台灣月份」的資料，避免在 UTC server 上用
 * new Date(y, m-1, 1) 切出台北 08:00 才換月、凌晨的單歸錯月。
 */
export function taipeiMonthRange(monthStr: string): {
  startIso: string;
  endIso: string;
} | null {
  const m = monthStr.match(/^(\d{4})-(\d{2})$/);
  if (!m) return null;
  const y = Number(m[1]);
  const mo = Number(m[2]);
  if (!y || mo < 1 || mo > 12) return null;
  const nextY = mo === 12 ? y + 1 : y;
  const nextMo = mo === 12 ? 1 : mo + 1;
  const startIso = new Date(
    `${m[1]}-${m[2]}-01T00:00:00${TAIPEI_OFFSET}`,
  ).toISOString();
  const endIso = new Date(
    `${nextY}-${String(nextMo).padStart(2, "0")}-01T00:00:00${TAIPEI_OFFSET}`,
  ).toISOString();
  return { startIso, endIso };
}

/** timestamptz ISO → 台灣 "M/D"，供精簡日期顯示。 */
export function formatTaipeiMonthDay(iso: string | null | undefined): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "—";
  const p = taipeiParts(d);
  return `${Number(p.month)}/${Number(p.day)}`;
}
