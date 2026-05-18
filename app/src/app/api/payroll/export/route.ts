import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/dal";
import { fetchPayroll } from "@/lib/payroll";

export const dynamic = "force-dynamic";

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return new Response("Unauthorized", { status: 401 });
  // owner / manager can export anyone; technician only their own
  const userId = req.nextUrl.searchParams.get("user");
  const month = req.nextUrl.searchParams.get("month");
  if (!userId || !month) {
    return new Response("missing user or month", { status: 400 });
  }
  if (
    me.profile.role === "technician" &&
    me.id !== userId
  ) {
    return new Response("Forbidden", { status: 403 });
  }

  const data = await fetchPayroll(userId, month);
  if (!data) return new Response("Not found", { status: 404 });

  // Build sheet matching the 2026年五月份 Excel layout
  const header1: (string | null)[] = [
    "日期",
    "當日應收",
    "代號",
    "第一台", "姓名", "編號", "加大", "其他", "折扣", "匯款",
    "代號",
    "第二台", "姓名", "編號", "加大", "其他", "折扣", "匯款",
    "代號",
    "第三台", "姓名", "編號", "加大", "其他", "折扣", "匯款",
    "代號",
    "第四台", "姓名", "編號", "加大", "其他", "折扣", "匯款",
  ];

  const aoa: (string | number | null)[][] = [];
  aoa.push([`${month} ${data.technician.name}`]);
  aoa.push(header1);

  for (const row of data.rows) {
    const r: (string | number | null)[] = [row.day];
    const dayNet = row.dayTotal + row.addonTotal - row.discountTotal;
    r.push(row.items.length > 0 ? dayNet : "");
    for (let i = 0; i < 4; i++) {
      const it = row.items[i];
      if (it) {
        r.push(it.tag ?? "");
        r.push(it.unit_price);
        r.push(it.customer_name);
        r.push(it.customer_code);
        r.push(i === 0 && row.addonTotal > 0 ? row.addonTotal : "");
        r.push(""); // 其他 column reserved
        r.push(i === 0 && row.discountTotal > 0 ? row.discountTotal : "");
        r.push(
          i === 0 && row.transferredCount > 0 ? "✓" : "",
        );
      } else {
        r.push("", "", "", "", "", "", "", "");
      }
    }
    aoa.push(r);
  }

  // Total row
  aoa.push([
    "總",
    data.monthTotal,
    ...Array.from({ length: 32 }).map(() => ""),
  ]);

  const ws = XLSX.utils.aoa_to_sheet(aoa);
  // Set column widths roughly
  ws["!cols"] = [
    { wch: 6 }, { wch: 12 }, ...Array.from({ length: 32 }).map(() => ({ wch: 10 })),
  ];

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, ws, `${data.technician.name}`);

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `payroll_${data.technician.name}_${month}.xlsx`;

  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
