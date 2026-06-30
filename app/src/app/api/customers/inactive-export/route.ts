import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/dal";
import { computeCustomerStats, formatMonths } from "@/lib/customer-stats";

export const dynamic = "force-dynamic";

function csvEscape(v: unknown): string {
  if (v === null || v === undefined) return "";
  const s = String(v);
  if (s.includes(",") || s.includes('"') || s.includes("\n")) {
    return `"${s.replace(/"/g, '""')}"`;
  }
  return s;
}

type Row = {
  id: string;
  code: string;
  name: string;
  phone: string;
  note: string | null;
  created_at: string;
  source: { name: string } | null;
  addresses: {
    county: string;
    district: string;
    address: string;
    is_default: boolean;
    merged_into_id: string | null;
  }[];
  orders: { status: string; service_at: string | null; total: number }[];
};

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || (me.profile.role !== "owner" && me.profile.role !== "manager")) {
    return new Response("Unauthorized", { status: 401 });
  }

  // years=1 → 12 個月沒消費；years=2 → 24 個月沒消費
  const yearsRaw = Number(req.nextUrl.searchParams.get("years"));
  const years = yearsRaw === 2 ? 2 : 1;
  const thresholdMonths = years * 12;

  const supabase = await createClient();
  const { data } = await supabase
    .from("customers")
    .select(
      `id, code, name, phone, note, created_at,
       source:customer_sources(name),
       addresses:customer_addresses(county, district, address, is_default, merged_into_id),
       orders(status, service_at, total)`,
    )
    .order("created_at", { ascending: false })
    .limit(5000);

  const rows = (data as Row[] | null) ?? [];

  type Out = {
    row: Row;
    neverPurchased: boolean;
    lastServiceAt: string | null;
    monthsSinceLast: number | null;
    doneCount: number;
  };

  const out: Out[] = [];
  for (const c of rows) {
    const stats = computeCustomerStats(c.orders ?? []);
    const neverPurchased = stats.doneCount === 0;
    if (neverPurchased) {
      // 只建檔、從未完成消費 → 一律納入
      out.push({
        row: c,
        neverPurchased: true,
        lastServiceAt: null,
        monthsSinceLast: null,
        doneCount: 0,
      });
    } else if (
      stats.monthsSinceLast !== null &&
      stats.monthsSinceLast >= thresholdMonths
    ) {
      // 曾消費、但已 N 年沒回來
      out.push({
        row: c,
        neverPurchased: false,
        lastServiceAt: stats.lastServiceAt,
        monthsSinceLast: stats.monthsSinceLast,
        doneCount: stats.doneCount,
      });
    }
  }

  // 排序：先列沉睡舊客（依最後消費由舊到新），未消費客戶集中放最後（依建檔由舊到新）
  out.sort((a, b) => {
    if (a.neverPurchased !== b.neverPurchased) {
      return a.neverPurchased ? 1 : -1;
    }
    if (a.neverPurchased) {
      return a.row.created_at.localeCompare(b.row.created_at);
    }
    return (a.lastServiceAt ?? "").localeCompare(b.lastServiceAt ?? "");
  });

  const header = [
    "客戶類型",
    "編號",
    "姓名",
    "主要電話",
    "縣市",
    "鄉鎮市區",
    "詳細地址",
    "客戶來源",
    "建檔日期",
    "最後消費日期",
    "距今多久",
    "完成訂單數",
    "備註",
  ];

  const lines: string[] = [header.map(csvEscape).join(",")];
  for (const o of out) {
    const c = o.row;
    const liveAddresses = (c.addresses ?? []).filter((a) => !a.merged_into_id);
    const main =
      liveAddresses.find((a) => a.is_default) ?? liveAddresses[0] ?? null;
    lines.push(
      [
        o.neverPurchased ? "僅建檔・未消費" : "舊客・已沉睡",
        c.code,
        c.name,
        c.phone,
        main?.county ?? "",
        main?.district ?? "",
        main?.address ?? "",
        c.source?.name ?? "",
        c.created_at ? c.created_at.slice(0, 10) : "",
        o.lastServiceAt ? o.lastServiceAt.slice(0, 10) : "（從未消費）",
        o.neverPurchased ? "（從未消費）" : formatMonths(o.monthsSinceLast),
        o.doneCount,
        c.note ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  const bom = "﻿";
  const body = bom + lines.join("\r\n");
  const filename = `未消費客戶名單_${years}年_${new Date()
    .toISOString()
    .slice(0, 10)}.csv`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
