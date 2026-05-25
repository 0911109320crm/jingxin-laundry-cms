import { NextRequest } from "next/server";
import * as XLSX from "xlsx";
import { getCurrentUser } from "@/lib/dal";
import { fetchPayroll } from "@/lib/payroll";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";

const PAYMENT_LABEL: Record<string, string> = {
  unpaid: "未收款",
  cash: "現金",
  transfer: "匯款",
  card: "刷卡",
  line_pay: "LINE Pay",
};

function tw(monthStr: string) {
  const [y, m] = monthStr.split("-").map(Number);
  return `${y} 年 ${m} 月`;
}

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me) return new Response("Unauthorized", { status: 401 });

  const userId = req.nextUrl.searchParams.get("user");
  const month = req.nextUrl.searchParams.get("month");
  if (!userId || !month) {
    return new Response("missing user or month", { status: 400 });
  }
  if (me.profile.role === "technician" && me.id !== userId) {
    return new Response("Forbidden", { status: 403 });
  }

  const data = await fetchPayroll(userId, month);
  if (!data) return new Response("Not found", { status: 404 });

  // Fetch promotions + KPI for this technician/month
  const admin = createAdminClient();
  const [y, m] = month.split("-").map(Number);
  const monthStart = new Date(y, m - 1, 1).toISOString();
  const monthEnd = new Date(y, m, 1).toISOString();

  const [{ data: promosRaw }, { data: kpiRow }] = await Promise.all([
    admin
      .from("order_promotions")
      .select(
        "id, points_snapshot, created_at, type:promotion_types(label), order:orders(order_code, customer:customers(name))",
      )
      .eq("credited_to", userId)
      .gte("created_at", monthStart)
      .lt("created_at", monthEnd)
      .order("created_at", { ascending: true }),
    admin
      .from("system_settings")
      .select("value")
      .eq("key", "monthly_promotion_kpi")
      .maybeSingle(),
  ]);

  type PromoRow = {
    id: string;
    points_snapshot: number;
    created_at: string;
    type: { label: string } | null;
    order: { order_code: string; customer: { name: string } | null } | null;
  };
  const promos = (promosRaw as PromoRow[] | null) ?? [];
  const kpi = typeof kpiRow?.value === "number" ? kpiRow.value : 30;
  const totalPoints = promos.reduce((s, p) => s + Number(p.points_snapshot), 0);
  const achieved = totalPoints >= kpi;

  const exportDate = new Date().toLocaleDateString("zh-TW");
  const monthLabel = tw(month);

  // ── 建立工作表 1：薪資總覽 ──────────────────────────────────────────────

  const defaultDesc =
    data.defaultCommissionType === "percent"
      ? `預設 ${data.defaultCommissionValue}%`
      : `預設 NT$ ${data.defaultCommissionValue}/件`;

  const summary: (string | number)[][] = [
    ["淨新清潔工坊管理系統 — 師傅薪資對帳單"],
    [],
    ["師傅姓名", data.technician.name, "", "月份", monthLabel, "", "匯出日期", exportDate],
    [],
    ["【本月薪資摘要】"],
    ["項目", "金額", "說明"],
    ["服務案件總筆數", `${data.totalItems} 筆`, ""],
    ["計件抽成合計", data.monthBaseCommission, defaultDesc],
    ["加價合計（進薪資）", data.monthAddon, "在「設定 → 折扣 / 加價項目」勾選「進薪資」的項目"],
    ["折扣合計（進薪資）", -data.monthDiscount, "客戶議價等扣師傅；節慶折扣等不算"],
    ["本月獎勵合計", data.monthBonus, "老闆娘月度手動加的獎勵"],
    ["本月扣款合計", -data.monthDeduction, "老闆娘月度手動加的扣款"],
    ["本月應發薪資", data.monthTotal, data.finalized ? "✓ 已結算鎖定" : "未結算（即時計算）"],
    [],
    ["【業績目標（積分）】"],
    ["項目", "說明"],
    ["本月積分", `${totalPoints} 點`],
    ["目標積分", `${kpi} 點`],
    ["達標狀態", achieved ? `✓ 已達標（${totalPoints}/${kpi}）` : `✗ 未達標（差 ${kpi - totalPoints} 點）`],
    [],
    ["＊ 抽成方式依「設定 → 服務項目」每筆設定為準，未設則套用預設"],
    ["＊ 實際應發薪資以老闆娘核准為準"],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summary);
  wsSummary["!cols"] = [
    { wch: 22 }, { wch: 14 }, { wch: 36 }, { wch: 10 }, { wch: 14 }, { wch: 4 }, { wch: 10 }, { wch: 14 },
  ];
  wsSummary["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

  // ── 建立工作表 2：案件計件明細 ─────────────────────────────────────────

  const detailHeader = [
    "日期",
    "訂單編號",
    "客戶姓名",
    "客戶編號",
    "服務項目",
    "代號",
    "原價（小計）",
    "抽成方式",
    "計件抽成",
    "加價（進薪資）",
    "折扣（進薪資）",
    "本筆小計",
    "收款方式",
    "備註",
  ];

  const detailRows: (string | number)[][] = [];
  let totalSubtotal = 0;

  for (const row of data.rows) {
    if (row.items.length === 0) continue;
    for (const it of row.items) {
      totalSubtotal += it.subtotal;
      const lineSubtotal =
        it.commission_amount + it.order_addons - it.order_discount;
      detailRows.push([
        row.date,
        it.order_code,
        it.customer_name,
        it.customer_code,
        it.service_name ?? "（未分類）",
        it.tag ?? "",
        it.subtotal,
        it.commission_label,
        it.commission_amount,
        it.order_addons > 0 ? it.order_addons : "",
        it.order_discount > 0 ? it.order_discount : "",
        lineSubtotal,
        PAYMENT_LABEL[it.payment_method] ?? it.payment_method,
        "",
      ]);
    }
  }

  detailRows.push([
    "合計", "", "", "", "", "",
    totalSubtotal,
    "",
    data.monthBaseCommission,
    data.monthAddon,
    data.monthDiscount > 0 ? data.monthDiscount : "",
    data.monthBaseCommission + data.monthAddon - data.monthDiscount,
    "", "",
  ]);

  const wsDetail = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]);
  wsDetail["!cols"] = [
    { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 10 },
    { wch: 20 }, { wch: 8 }, { wch: 12 }, { wch: 14 },
    { wch: 12 }, { wch: 14 }, { wch: 14 }, { wch: 12 },
    { wch: 12 }, { wch: 16 },
  ];

  // ── 建立工作表 3：月度獎勵 / 扣款 ─────────────────────────────────────

  const adjHeader = ["建立時間", "類型", "金額", "原因"];
  const adjRows: (string | number)[][] = data.monthlyAdjustments.map((a) => [
    a.created_at.slice(0, 10),
    a.type === "bonus" ? "獎勵" : "扣款",
    a.type === "bonus" ? a.amount : -a.amount,
    a.reason,
  ]);
  if (adjRows.length > 0) {
    adjRows.push([
      "合計",
      "",
      data.monthBonus - data.monthDeduction,
      "",
    ]);
  } else {
    adjRows.push(["本月無獎勵 / 扣款紀錄", "", "", ""]);
  }
  const wsAdj = XLSX.utils.aoa_to_sheet([adjHeader, ...adjRows]);
  wsAdj["!cols"] = [{ wch: 14 }, { wch: 10 }, { wch: 12 }, { wch: 40 }];

  // ── 建立工作表 4：積分明細 ─────────────────────────────────────────────

  const promoHeader = ["日期", "訂單編號", "客戶姓名", "積分類型", "點數"];
  const promoRows: (string | number)[][] = promos.map((p) => [
    p.created_at.slice(0, 10),
    p.order?.order_code ?? "",
    p.order?.customer?.name ?? "",
    p.type?.label ?? "",
    p.points_snapshot,
  ]);

  if (promos.length > 0) {
    promoRows.push(["合計", "", "", "", totalPoints]);
  } else {
    promoRows.push(["本月尚無積分紀錄", "", "", "", ""]);
  }

  const wsPromo = XLSX.utils.aoa_to_sheet([promoHeader, ...promoRows]);
  wsPromo["!cols"] = [
    { wch: 12 }, { wch: 14 }, { wch: 12 }, { wch: 20 }, { wch: 8 },
  ];

  // ── 組合活頁簿 ─────────────────────────────────────────────────────────

  const wb = XLSX.utils.book_new();
  XLSX.utils.book_append_sheet(wb, wsSummary, "薪資總覽");
  XLSX.utils.book_append_sheet(wb, wsDetail, "案件計件明細");
  XLSX.utils.book_append_sheet(wb, wsAdj, "月度獎勵扣款");
  XLSX.utils.book_append_sheet(wb, wsPromo, "積分明細");

  const buf = XLSX.write(wb, { type: "buffer", bookType: "xlsx" });
  const filename = `薪資對帳單_${data.technician.name}_${month}.xlsx`;

  return new Response(buf, {
    headers: {
      "Content-Type":
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
