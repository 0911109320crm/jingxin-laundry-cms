import { NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getCurrentUser } from "@/lib/dal";

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
  joined_at: string | null;
  source: { name: string } | null;
  addresses: {
    county: string;
    district: string;
    address: string;
    is_default: boolean;
  }[];
  machines: {
    type: string;
    brand: string | null;
    model: string | null;
    sub_type: string | null;
  }[];
};

const MACHINE_TYPE: Record<string, string> = {
  washing_machine: "洗衣機",
  air_conditioner: "冷氣",
  mattress: "床墊",
  sofa: "沙發",
  other: "其他",
};

export async function GET(req: NextRequest) {
  const me = await getCurrentUser();
  if (!me || (me.profile.role !== "owner" && me.profile.role !== "manager")) {
    return new Response("Unauthorized", { status: 401 });
  }

  const sp = req.nextUrl.searchParams;
  const q = sp.get("q")?.trim() ?? "";
  const county = sp.get("county") ?? "";
  const district = sp.get("district") ?? "";

  const supabase = await createClient();
  let query = supabase
    .from("customers")
    .select(
      `id, code, name, phone, note, joined_at,
       source:customer_sources(name),
       addresses:customer_addresses(county, district, address, is_default),
       machines(type, brand, model, sub_type)`,
    )
    .order("created_at", { ascending: false })
    .limit(2000);

  if (q) {
    const like = `%${q}%`;
    query = query.or(
      `name.ilike.${like},phone.ilike.${like},code.ilike.${like},note.ilike.${like}`,
    );
  }

  const { data } = await query;
  let rows = (data as Row[] | null) ?? [];

  if (county || district) {
    rows = rows.filter((c) =>
      c.addresses.some(
        (a) =>
          (!county || a.county === county) &&
          (!district || a.district === district),
      ),
    );
  }

  const header = [
    "編號",
    "姓名",
    "電話",
    "縣市",
    "鄉鎮市區",
    "詳細地址",
    "客戶來源",
    "加入日期",
    "機器類型",
    "備註",
  ];

  const lines: string[] = [header.map(csvEscape).join(",")];
  for (const c of rows) {
    const main =
      c.addresses.find((a) => a.is_default) ?? c.addresses[0] ?? null;
    const machineLabel = c.machines
      .map(
        (m) =>
          `${MACHINE_TYPE[m.type] ?? m.type}${
            m.brand ? ` ${m.brand}` : ""
          }${m.model ? ` ${m.model}` : ""}${m.sub_type ? `(${m.sub_type})` : ""}`,
      )
      .join(" / ");
    lines.push(
      [
        c.code,
        c.name,
        c.phone,
        main?.county ?? "",
        main?.district ?? "",
        main?.address ?? "",
        c.source?.name ?? "",
        c.joined_at ?? "",
        machineLabel,
        c.note ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  const bom = "﻿";
  const body = bom + lines.join("\r\n");
  const filename = `customers_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="${filename}"`,
      "Cache-Control": "no-store",
    },
  });
}
