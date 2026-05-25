"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";

const Schema = z.object({
  default_commission_type: z.enum(["percent", "amount"]),
  default_commission_value: z.coerce
    .number()
    .min(0, "抽成數值不可為負"),
});

export type Res = { ok: true } | { ok: false; error: string };

export async function updateDefaultCommission(fd: FormData): Promise<Res> {
  await requireRole(["owner"]);
  const parsed = Schema.safeParse({
    default_commission_type: fd.get("default_commission_type"),
    default_commission_value: fd.get("default_commission_value") ?? 0,
  });
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  if (
    parsed.data.default_commission_type === "percent" &&
    parsed.data.default_commission_value > 100
  ) {
    return { ok: false, error: "百分比不可超過 100" };
  }

  const supabase = await createClient();
  const { error } = await supabase.from("system_settings").upsert(
    [
      {
        key: "default_commission_type",
        value: parsed.data.default_commission_type,
        description: "預設抽成方式（service_items.commission_type=default 時套用）",
      },
      {
        key: "default_commission_value",
        value: parsed.data.default_commission_value,
        description: "預設抽成數值",
      },
    ],
    { onConflict: "key" },
  );
  if (error) return { ok: false, error: error.message };

  revalidatePath("/settings/payroll");
  revalidatePath("/payroll");
  return { ok: true };
}
