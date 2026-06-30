import * as XLSX from "xlsx";

type Cell = string | number | null | undefined;

// CJK / 全形字元在 Excel 預設字型約佔 2 個半形字寬，計寬時算 2。
const WIDE_CHAR =
  /[ᄀ-ᅟ⺀-꓏가-힣豈-﫿︰-﹏＀-｠￠-￦]/;

function displayWidth(s: string): number {
  let w = 0;
  for (const ch of s) w += WIDE_CHAR.test(ch) ? 2 : 1;
  return w;
}

/** 依每欄最長內容自動算欄寬（含表頭），讓 Excel 一開就完整顯示、不用手動拉。 */
export function autoColWidths(
  aoa: Cell[][],
  opts?: { min?: number; max?: number; pad?: number },
): { wch: number }[] {
  const min = opts?.min ?? 6;
  const max = opts?.max ?? 60;
  const pad = opts?.pad ?? 2;
  const widths: number[] = [];
  for (const row of aoa) {
    row.forEach((cell, i) => {
      const w = displayWidth(cell == null ? "" : String(cell));
      if (w > (widths[i] ?? 0)) widths[i] = w;
    });
  }
  return widths.map((w) => ({ wch: Math.min(max, Math.max(min, w + pad)) }));
}

/** 由表頭 + 資料列產生一份自動欄寬的單工作表 xlsx，回傳可直接下載的 Response。 */
export function buildXlsxResponse(opts: {
  header: string[];
  rows: Cell[][];
  sheetName: string;
  filename: string;
}): Response {
  const aoa: Cell[][] = [opts.header, ...opts.rows];
  const ws = XLSX.utils.aoa_to_sheet(aoa);
  ws["!cols"] = autoColWidths(aoa);

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, opts.sheetName);
  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });

  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(
        opts.filename,
      )}`,
      "Cache-Control": "no-store",
    },
  });
}
