import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { getCurrentUser } from "@/lib/dal";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  SETTLEMENT_STATUS_LABEL,
} from "@/lib/validators/order";

export const dynamic = "force-dynamic";

type Range = "today" | "week" | "month" | "quarter" | "year" | "custom";

function dateRange(range: Range, from?: string, to?: string) {
  const now = new Date();
  const startOfToday = new Date(now.getFullYear(), now.getMonth(), now.getDate());
  let start = new Date(startOfToday);
  let end = new Date(startOfToday);
  end.setDate(end.getDate() + 1);
  switch (range) {
    case "week": {
      const day = now.getDay();
      const mondayOffset = (day + 6) % 7;
      start.setDate(start.getDate() - mondayOffset);
      end = new Date(start);
      end.setDate(end.getDate() + 7);
      break;
    }
    case "month":
      start = new Date(now.getFullYear(), now.getMonth(), 1);
      end = new Date(now.getFullYear(), now.getMonth() + 1, 1);
      break;
    case "quarter": {
      const q = Math.floor(now.getMonth() / 3);
      start = new Date(now.getFullYear(), q * 3, 1);
      end = new Date(now.getFullYear(), q * 3 + 3, 1);
      break;
    }
    case "year":
      start = new Date(now.getFullYear(), 0, 1);
      end = new Date(now.getFullYear() + 1, 0, 1);
      break;
    case "custom":
      if (from) start = new Date(from);
      if (to) {
        end = new Date(to);
        end.setDate(end.getDate() + 1);
      }
      break;
  }
  return { start, end };
}

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

function fmtDateTime(iso: string | null): string {
  if (!iso) return "";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return "";
  return `${d.getFullYear()}/${String(d.getMonth() + 1).padStart(2, "0")}/${String(d.getDate()).padStart(2, "0")} ${String(d.getHours()).padStart(2, "0")}:${String(d.getMinutes()).padStart(2, "0")}`;
}

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || (me.profile.role !== "owner" && me.profile.role !== "manager")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const range = (sp.get("range") ?? "month") as Range;
  const { start, end } = dateRange(
    range,
    sp.get("from") ?? undefined,
    sp.get("to") ?? undefined,
  );

  const supabase = await createClient();
  const admin = createAdminClient();

  const { data: ordersRaw } = await supabase
    .from("orders")
    .select(
      `id, order_code, status, payment_method, settlement_status,
       scheduled_at, service_at, subtotal, adjustments_total, total,
       cancellation_reason,
       customer:customers(code, name, phone),
       address:customer_addresses(county, district, address),
       items:order_items(technician_id, quantity, unit_price, subtotal,
                         service:service_items(code, name))`,
    )
    .gte("scheduled_at", start.toISOString())
    .lt("scheduled_at", end.toISOString())
    .order("scheduled_at");

  type Row = {
    id: string;
    order_code: string;
    status: string;
    payment_method: string;
    settlement_status: string;
    scheduled_at: string | null;
    service_at: string | null;
    subtotal: number;
    adjustments_total: number;
    total: number;
    cancellation_reason: string | null;
    customer: { code: string; name: string; phone: string } | null;
    address: { county: string; district: string; address: string } | null;
    items: {
      technician_id: string | null;
      quantity: number;
      unit_price: number;
      subtotal: number;
      service: { code: string; name: string } | null;
    }[];
  };
  const rows = (ordersRaw as Row[] | null) ?? [];

  const techIdSet = new Set<string>();
  for (const r of rows) {
    for (const it of r.items) if (it.technician_id) techIdSet.add(it.technician_id);
  }
  let techMap = new Map<string, string>();
  if (techIdSet.size > 0) {
    const { data: techs } = await admin
      .from("user_profiles")
      .select("id, name")
      .in("id", Array.from(techIdSet));
    techMap = new Map(
      ((techs ?? []) as { id: string; name: string }[]).map((t) => [t.id, t.name]),
    );
  }

  const header = [
    "訂單編號",
    "預約時間",
    "完工時間",
    "狀態",
    "收款方式",
    "回繳狀態",
    "客戶編號",
    "客戶姓名",
    "電話",
    "縣市",
    "鄉鎮市區",
    "詳細地址",
    "服務項目",
    "師傅",
    "小計",
    "加減項",
    "應收總額",
    "取消原因",
  ];

  const lines: string[] = [header.map(csvEscape).join(",")];
  for (const r of rows) {
    const services = r.items
      .map((it) => it.service?.name)
      .filter(Boolean)
      .join(" / ");
    const techs = Array.from(
      new Set(
        r.items
          .map((it) => (it.technician_id ? techMap.get(it.technician_id) ?? "" : ""))
          .filter(Boolean),
      ),
    ).join(" / ");
    lines.push(
      [
        r.order_code,
        fmtDateTime(r.scheduled_at),
        fmtDateTime(r.service_at),
        ORDER_STATUS_LABEL[r.status] ?? r.status,
        PAYMENT_METHOD_LABEL[r.payment_method as keyof typeof PAYMENT_METHOD_LABEL] ?? r.payment_method,
        SETTLEMENT_STATUS_LABEL[r.settlement_status as keyof typeof SETTLEMENT_STATUS_LABEL] ?? r.settlement_status,
        r.customer?.code ?? "",
        r.customer?.name ?? "",
        r.customer?.phone ?? "",
        r.address?.county ?? "",
        r.address?.district ?? "",
        r.address?.address ?? "",
        services,
        techs,
        r.subtotal,
        r.adjustments_total,
        r.total,
        r.cancellation_reason ?? "",
      ].map(csvEscape).join(","),
    );
  }

  // BOM + content so Excel opens UTF-8 correctly
  const bom = "﻿";
  const body = bom + lines.join("\r\n");

  const filename = `report_${range}_${start.toISOString().slice(0, 10)}_${new Date(
    end.getTime() - 86400000,
  )
    .toISOString()
    .slice(0, 10)}.csv`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
