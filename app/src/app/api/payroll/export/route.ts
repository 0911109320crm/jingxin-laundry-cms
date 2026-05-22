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

// 模擬計件抽成規則（正式規則由老闆娘決定後再調整）
function simulatedCommission(
  serviceName: string | null,
  unitPrice: number,
): number {
  const name = (serviceName ?? "").toLowerCase();
  if (name.includes("滾筒")) return 700;
  if (name.includes("直立") || name.includes("洗衣")) return 500;
  if (name.includes("冷氣") || name.includes("空調")) return 600;
  if (name.includes("冰箱")) return 500;
  if (name.includes("烘衣") || name.includes("烘乾")) return 450;
  if (name.includes("床墊")) return 400;
  if (name.includes("沙發")) return 400;
  // 加大、車馬費等附加項 → 全額計入
  if (unitPrice <= 300) return unitPrice;
  return Math.round(unitPrice * 0.4);
}

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

  // 先算各項合計
  let totalCommission = 0;
  let totalAddon = 0;
  let totalDiscount = 0;
  let itemCount = 0;

  for (const row of data.rows) {
    for (const it of row.items) {
      totalCommission += simulatedCommission(it.service_name, it.unit_price);
      totalAddon += it.order_addons;
      totalDiscount += it.order_discount;
      itemCount++;
    }
  }
  const totalPay = totalCommission + totalAddon - totalDiscount;

  const summary: (string | number)[][] = [
    ["淨新洗衣管理系統 — 師傅薪資對帳單"],
    [],
    ["師傅姓名", data.technician.name, "", "月份", monthLabel, "", "匯出日期", exportDate],
    [],
    ["【本月薪資摘要】"],
    ["項目", "金額"],
    ["服務案件總筆數", `${itemCount} 筆`],
    ["計件抽成合計（模擬）", totalCommission],
    ["加大費合計", totalAddon],
    ["折扣合計", -totalDiscount],
    ["本月應發薪資", totalPay],
    [],
    ["【業績目標（積分）】"],
    ["項目", "說明"],
    ["本月積分", `${totalPoints} 點`],
    ["目標積分", `${kpi} 點`],
    ["達標狀態", achieved ? `✓ 已達標（${totalPoints}/${kpi}）` : `✗ 未達標（差 ${kpi - totalPoints} 點）`],
    ["業績獎金", "（由老闆娘另行決定）"],
    [],
    ["＊ 計件抽成為模擬數字，正式規則待老闆娘確認後調整"],
    ["＊ 實際應發薪資以老闆娘核准為準"],
  ];

  const wsSummary = XLSX.utils.aoa_to_sheet(summary);
  wsSummary["!cols"] = [
    { wch: 22 }, { wch: 18 }, { wch: 4 }, { wch: 10 }, { wch: 14 }, { wch: 4 }, { wch: 10 }, { wch: 14 },
  ];
  // 合併標題列
  wsSummary["!merges"] = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 7 } }];

  // ── 建立工作表 2：案件計件明細 ─────────────────────────────────────────

  const detailHeader = [
    "日期",
    "訂單編號",
    "客戶姓名",
    "客戶編號",
    "服務項目",
    "代號",
    "收費金額",
    "計件抽成（模擬）",
    "加大費",
    "折扣",
    "本筆小計",
    "收款方式",
    "備註",
  ];

  const detailRows: (string | number)[][] = [];
  let rowIndex = 1;

  for (const row of data.rows) {
    if (row.items.length === 0) continue;
    for (const it of row.items) {
      const commission = simulatedCommission(it.service_name, it.unit_price);
      const subtotal = commission + it.order_addons - it.order_discount;
      detailRows.push([
        row.date,                                     // 日期
        it.order_code,                                // 訂單編號
        it.customer_name,                             // 客戶姓名
        it.customer_code,                             // 客戶編號
        it.service_name ?? "（未分類）",              // 服務項目
        it.tag ?? "",                                 // 代號
        it.unit_price,                                // 收費金額
        commission,                                   // 計件抽成（模擬）
        it.order_addons > 0 ? it.order_addons : "",   // 加大費
        it.order_discount > 0 ? it.order_discount : "", // 折扣
        subtotal,                                     // 本筆小計
        PAYMENT_LABEL[it.payment_method] ?? it.payment_method, // 收款方式
        "",                                           // 備註（留空供填寫）
      ]);
      rowIndex++;
    }
  }

  // 合計列
  detailRows.push([
    "合計", "", "", "", "", "",
    data.rows.reduce((s, r) => s + r.items.reduce((ss, i) => ss + i.unit_price, 0), 0),
    totalCommission,
    totalAddon,
    totalDiscount > 0 ? totalDiscount : "",
    totalPay,
    "", "",
  ]);

  const wsDetail = XLSX.utils.aoa_to_sheet([detailHeader, ...detailRows]);
  wsDetail["!cols"] = [
    { wch: 12 }, // 日期
    { wch: 14 }, // 訂單編號
    { wch: 12 }, // 客戶姓名
    { wch: 10 }, // 客戶編號
    { wch: 20 }, // 服務項目
    { wch: 8 },  // 代號
    { wch: 12 }, // 收費金額
    { wch: 16 }, // 計件抽成
    { wch: 10 }, // 加大費
    { wch: 8 },  // 折扣
    { wch: 12 }, // 本筆小計
    { wch: 12 }, // 收款方式
    { wch: 16 }, // 備註
  ];

  // ── 建立工作表 3：積分明細 ─────────────────────────────────────────────

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
