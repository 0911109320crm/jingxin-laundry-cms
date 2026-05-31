"use server";

import { revalidatePath } from "next/cache";
import { createClient } from "@/lib/supabase/server";
import { requireRole } from "@/lib/dal";
import { logAudit } from "@/lib/audit";

export type Res = { ok: true } | { ok: false; error: string };
export type LeavePeriod = "full" | "am" | "pm";

/**
 * 設定師傅某天的休假。
 * 互斥規則：設「全日」會清掉當天的上午/下午；設「上午或下午」會清掉當天的「全日」。
 */
export async function setTechnicianLeave(
  technicianId: string,
  dateStr: string,
  period: LeavePeriod,
): Promise<Res> {
  await requireRole(["owner", "manager"]);
  if (!technicianId || !dateStr) return { ok: false, error: "缺少師傅或日期" };
  if (!["full", "am", "pm"].includes(period))
    return { ok: false, error: "時段錯誤" };

  const supabase = await createClient();

  if (period === "full") {
    await supabase
      .from("technician_leave")
      .delete()
      .eq("technician_id", technicianId)
      .eq("leave_date", dateStr)
      .in("period", ["am", "pm"]);
  } else {
    await supabase
      .from("technician_leave")
      .delete()
      .eq("technician_id", technicianId)
      .eq("leave_date", dateStr)
      .eq("period", "full");
  }

  const { error } = await supabase.from("technician_leave").upsert(
    { technician_id: technicianId, leave_date: dateStr, period },
    { onConflict: "technician_id,leave_date,period" },
  );
  if (error) return { ok: false, error: error.message };

  await logAudit({
    action: "leave.set",
    target_type: "technician",
    target_id: technicianId,
    payload: { date: dateStr, period },
  });
  revalidatePath("/calendar/month");
  return { ok: true };
}

/** 取消某師傅某天的所有休假（全日 / 上午 / 下午一併清掉）。 */
export async function removeTechnicianLeave(
  technicianId: string,
  dateStr: string,
): Promise<Res> {
  await requireRole(["owner", "manager"]);
  if (!technicianId || !dateStr) return { ok: false, error: "缺少師傅或日期" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("technician_leave")
    .delete()
    .eq("technician_id", technicianId)
    .eq("leave_date", dateStr);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    action: "leave.remove",
    target_type: "technician",
    target_id: technicianId,
    payload: { date: dateStr },
  });
  revalidatePath("/calendar/month");
  return { ok: true };
}
