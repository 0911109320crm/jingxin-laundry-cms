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
  created_at: string;
  source: { name: string } | null;
  phones: {
    phone: string;
    label: string | null;
    is_primary: boolean;
    sort_order: number;
  }[];
  addresses: {
    county: string;
    district: string;
    address: string;
    is_default: boolean;
    merged_into_id: string | null;
  }[];
  machines: {
    type: string;
    brand: string | null;
    model: string | null;
    sub_type: string | null;
  }[];
};

const MACHINE_TYPE: Record<string, string> = {
  washing_vertical: "直立式洗衣機",
  washing_twin_tub: "雙槽式洗衣機",
  washing_drum: "滾筒式洗衣機",
  ac_split: "分離式冷氣",
  ac_hidden: "吊隱式冷氣",
  mattress: "床墊",
  sofa: "沙發",
  other: "其他",
  // 舊資料
  washing_machine: "洗衣機（待分類）",
  air_conditioner: "冷氣（待分類）",
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
      `id, code, name, phone, note, created_at,
       source:customer_sources(name),
       phones:customer_phones(phone, label, is_primary, sort_order),
       addresses:customer_addresses(county, district, address, is_default, merged_into_id),
       machines(type, brand, model, sub_type)`,
    )
    .order("created_at", { ascending: false })
    .limit(2000);

  if (q) {
    const like = `%${q}%`;
    // 同清單頁：含數字 → 也查 customer_phones
    const digits = q.replace(/\D/g, "");
    let extraIds: string[] = [];
    if (digits.length >= 4) {
      const { data: phoneHits } = await supabase
        .from("customer_phones")
        .select("customer_id")
        .ilike("phone", `%${digits}%`)
        .limit(500);
      extraIds = Array.from(
        new Set(
          ((phoneHits as { customer_id: string }[] | null) ?? []).map(
            (r) => r.customer_id,
          ),
        ),
      );
    }
    const orParts = [
      `name.ilike.${like}`,
      `phone.ilike.${like}`,
      `code.ilike.${like}`,
      `note.ilike.${like}`,
    ];
    if (extraIds.length > 0) orParts.push(`id.in.(${extraIds.join(",")})`);
    query = query.or(orParts.join(","));
  }

  const { data } = await query;
  let rows = (data as Row[] | null) ?? [];

  if (county || district) {
    rows = rows.filter((c) =>
      c.addresses.some(
        (a) =>
          !a.merged_into_id &&
          (!county || a.county === county) &&
          (!district || a.district === district),
      ),
    );
  }

  const header = [
    "編號",
    "姓名",
    "主要電話",
    "副電話",
    "縣市",
    "鄉鎮市區",
    "詳細地址",
    "客戶來源",
    "建檔日期",
    "機器類型",
    "備註",
  ];

  const lines: string[] = [header.map(csvEscape).join(",")];
  for (const c of rows) {
    const liveAddresses = c.addresses.filter((a) => !a.merged_into_id);
    const main =
      liveAddresses.find((a) => a.is_default) ?? liveAddresses[0] ?? null;
    const machineLabel = c.machines
      .map(
        (m) =>
          `${MACHINE_TYPE[m.type] ?? m.type}${
            m.brand ? ` ${m.brand}` : ""
          }${m.model ? ` ${m.model}` : ""}${m.sub_type ? `(${m.sub_type})` : ""}`,
      )
      .join(" / ");
    const sortedPhones = [...(c.phones ?? [])].sort(
      (a, b) => (a.sort_order ?? 0) - (b.sort_order ?? 0),
    );
    const extras = sortedPhones
      .filter((p) => !p.is_primary)
      .map((p) => `${p.phone}${p.label ? `（${p.label}）` : ""}`)
      .join(" / ");
    lines.push(
      [
        c.code,
        c.name,
        c.phone,
        extras,
        main?.county ?? "",
        main?.district ?? "",
        main?.address ?? "",
        c.source?.name ?? "",
        c.created_at ? c.created_at.slice(0, 10) : "",
        machineLabel,
        c.note ?? "",
      ]
        .map(csvEscape)
        .join(","),
    );
  }

  const bom = "﻿";
  const body = bom + lines.join("\r\n");
  const filename = `客戶名單_${new Date().toISOString().slice(0, 10)}.csv`;

  return new Response(body, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename*=UTF-8''${encodeURIComponent(filename)}`,
      "Cache-Control": "no-store",
    },
  });
}
