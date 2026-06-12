"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { createClient } from "@/lib/supabase/server";
import { requireWriteRole } from "@/lib/dal";

export type Res = { ok: true } | { ok: false; error: string };

/**
 * 技師操作品項前的共用檢查（owner/manager 兜底全權，不在此擋）：
 *   - 只能改自己負責的 order_item
 *   - 案件已完成(done)後不可改
 *   - blockPaid: 已收款(payment_method 非 unpaid/null)後不可再改金額相關欄位
 *     —— 收款發生在完成之前，只擋 done 會留下「收完款再改價」的洞
 */
async function techItemGuard(
  me: Awaited<ReturnType<typeof requireWriteRole>>,
  input: { order_id: string; order_item_id: string },
  opts: { blockPaid: boolean },
): Promise<string | null> {
  if (me.profile.role !== "technician") return null;

  const supabase = await createClient();
  const { data: owns } = await supabase
    .from("order_items")
    .select("id")
    .eq("id", input.order_item_id)
    .eq("technician_id", me.id)
    .limit(1);
  if (!Array.isArray(owns) || owns.length === 0) {
    return "不是你負責的明細";
  }

  const { data: ord } = await supabase
    .from("orders")
    .select("status, payment_method")
    .eq("id", input.order_id)
    .single();
  const o = ord as { status: string; payment_method: string | null } | null;
  if (o?.status === "done") {
    return "案件已完成，無法修改，請聯絡老闆娘";
  }
  if (opts.blockPaid && o?.payment_method && o.payment_method !== "unpaid") {
    return "已收款，金額不可再修改；要調整請先「改回未收款」或聯絡老闆娘";
  }
  return null;
}

const SwapSchema = z.object({
  order_id: z.string().uuid(),
  order_item_id: z.string().uuid(),
  service_item_id: z.string().uuid(),
  quantity: z.number().int().min(1).max(99),
});

/**
 * 師傅在現場把「老闆娘建單時的基本品項」換成實際看到的 service_item。
 * 同時帶入該 service_item 的 default_price 重算 subtotal，
 * trigger refresh_order_totals 會自動更新 orders.total。
 */
export async function swapOrderItemServiceAction(input: {
  order_id: string;
  order_item_id: string;
  service_item_id: string;
  quantity: number;
}): Promise<Res> {
  const me = await requireWriteRole(["technician", "owner", "manager"]);
  const parsed = SwapSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const guardErr = await techItemGuard(me, parsed.data, { blockPaid: true });
  if (guardErr) return { ok: false, error: guardErr };

  const supabase = await createClient();

  // 取新 service_item 的 default_price
  const { data: svc, error: svcErr } = await supabase
    .from("service_items")
    .select("default_price, active")
    .eq("id", parsed.data.service_item_id)
    .single();
  if (svcErr || !svc) return { ok: false, error: "找不到服務項目" };
  const svcRow = svc as { default_price: number; active: boolean };
  if (!svcRow.active) return { ok: false, error: "此服務項目已停用" };

  const unitPrice = Number(svcRow.default_price);
  const subtotal = unitPrice * parsed.data.quantity;

  // technician 經 RLS 不能直接 update order_items，用 admin。
  // 改價後 confirmed 一律重置：否則「確認金額 → 改價」會帶著舊確認直接過收款閘門。
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin
    .from("order_items")
    .update({
      service_item_id: parsed.data.service_item_id,
      quantity: parsed.data.quantity,
      unit_price: unitPrice,
      subtotal,
      confirmed: false,
    })
    .eq("id", parsed.data.order_item_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/staff/order/${parsed.data.order_id}`);
  revalidatePath(`/orders/${parsed.data.order_id}`);
  return { ok: true };
}

/**
 * 師傅標記某品項「不服務」(機器拆不開等)。
 * order_items.excluded = true → trigger refresh_order_totals 會跳過該筆計算。
 * order_adjustments (拆解費/車馬費) 仍會計入 orders.total。
 */
const ToggleExcludedSchema = z.object({
  order_id: z.string().uuid(),
  order_item_id: z.string().uuid(),
  excluded: z.boolean(),
});

export async function toggleOrderItemExcludedAction(input: {
  order_id: string;
  order_item_id: string;
  excluded: boolean;
}): Promise<Res> {
  const me = await requireWriteRole(["technician", "owner", "manager"]);
  const parsed = ToggleExcludedSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  // excluded 直接增減 orders.total，已收款後不可再動
  const guardErr = await techItemGuard(me, parsed.data, { blockPaid: true });
  if (guardErr) return { ok: false, error: guardErr };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin
    .from("order_items")
    .update({ excluded: parsed.data.excluded })
    .eq("id", parsed.data.order_item_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/staff/order/${parsed.data.order_id}`);
  revalidatePath(`/orders/${parsed.data.order_id}`);
  return { ok: true };
}

/**
 * 師傅勾「未拆解」(機器沒拆開洗) — 薪資技術獎金每台 +undismantled_bonus。
 * 不影響訂單金額，故不受收款限制；案件完成後鎖定（薪資依據）。
 */
const ToggleUndismantledSchema = z.object({
  order_id: z.string().uuid(),
  order_item_id: z.string().uuid(),
  undismantled: z.boolean(),
});

export async function toggleOrderItemUndismantledAction(input: {
  order_id: string;
  order_item_id: string;
  undismantled: boolean;
}): Promise<Res> {
  const me = await requireWriteRole(["technician", "owner", "manager"]);
  const parsed = ToggleUndismantledSchema.safeParse(input);
  if (!parsed.success)
    return { ok: false, error: parsed.error.issues[0].message };

  const guardErr = await techItemGuard(me, parsed.data, { blockPaid: false });
  if (guardErr) return { ok: false, error: guardErr };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin
    .from("order_items")
    .update({ undismantled: parsed.data.undismantled })
    .eq("id", parsed.data.order_item_id);
  if (error) return { ok: false, error: error.message };

  revalidatePath(`/staff/order/${parsed.data.order_id}`);
  revalidatePath(`/orders/${parsed.data.order_id}`);
  return { ok: true };
}
