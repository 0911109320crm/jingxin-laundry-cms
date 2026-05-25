"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { OrderSchema, type OrderInput } from "@/lib/validators/order";
import { logAudit } from "@/lib/audit";

export type Res = { ok: true; id?: string } | { ok: false; error: string };

/** Fetch a customer's addresses and machines for the order form. */
export async function getCustomerContext(customerId: string) {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const [{ data: addresses }, { data: machines }] = await Promise.all([
    supabase
      .from("customer_addresses")
      .select("id, county, district, address, label, is_default")
      .eq("customer_id", customerId)
      .order("is_default", { ascending: false }),
    supabase
      .from("machines")
      .select("id, type, brand, model, sub_type, note, address_id")
      .eq("customer_id", customerId),
  ]);
  return {
    addresses: (addresses as {
      id: string;
      county: string;
      district: string;
      address: string;
      label: string | null;
      is_default: boolean;
    }[] | null) ?? [],
    machines: (machines as {
      id: string;
      type: string;
      brand: string | null;
      model: string | null;
      sub_type: string | null;
      note: string | null;
      address_id: string | null;
    }[] | null) ?? [],
  };
}

/**
 * Revert a scheduled order back to "待派工" (pending) status.
 * Keeps scheduled_at / scheduled_end_at / technician_id intact — they'll be
 * overwritten next time the order is dragged back onto the calendar.
 */
export async function unscheduleOrderAction(orderId: string): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ status: "pending" })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    action: "order.unschedule",
    target_type: "order",
    target_id: orderId,
  });
  revalidatePath("/calendar");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

/** Cancel an order with a reason (used by the calendar quick-cancel button). */
export async function cancelOrderAction(
  orderId: string,
  reason: string,
): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const trimmed = reason.trim();
  if (!trimmed) return { ok: false, error: "請填取消原因" };

  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({
      status: "cancelled",
      cancellation_reason: trimmed,
      cancelled_at: new Date().toISOString(),
    })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    action: "order.cancel",
    target_type: "order",
    target_id: orderId,
    payload: { reason: trimmed },
  });
  revalidatePath("/calendar");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

/** Preview the next order code for a given date (for display in the form). */
export async function previewOrderCodeAction(dateStr?: string): Promise<string> {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("generate_order_code", dateStr ? { p_date: dateStr } : {});
  if (error || !data) {
    const d = dateStr ? new Date(dateStr) : new Date();
    const prefix = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, "0")}${String(d.getDate()).padStart(2, "0")}`;
    return `${prefix}-001`;
  }
  return data as string;
}

async function nextOrderCode(supabase: Awaited<ReturnType<typeof createClient>>) {
  const { data, error } = await supabase.rpc("generate_order_code");
  if (error || !data) {
    // fallback (should not normally happen)
    const now = new Date();
    const prefix = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}${String(now.getDate()).padStart(2, "0")}`;
    return `${prefix}-001`;
  }
  return data as string;
}

export async function createOrderAction(input: OrderInput): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const parsed = OrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "資料錯誤" };
  }
  const data = parsed.data;
  const supabase = await createClient();
  const me = await getCurrentUser();

  const order_code = await nextOrderCode(supabase);

  // 老闆娘建單時的暫估金額（用基本價算）。實際金額由 trigger refresh_order_totals
  // 在 order_items 寫入後自動算到 orders.total；estimated_total 保留作對比。
  const estimatedTotal = data.items.reduce(
    (s, it) => s + (it.quantity || 0) * (it.unit_price || 0),
    0,
  );

  // 新訂單一律進「待派工」狀態，等老闆娘到月曆拖曳指派師傅
  // （師傅也強制清空，避免從 clone 或 API 帶入舊指派）
  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      order_code,
      customer_id: data.customer_id,
      address_id: data.address_id,
      scheduled_at: data.scheduled_at || null,
      scheduled_end_at: data.scheduled_end_at || null,
      service_at: data.service_at || null,
      duration_minutes: data.duration_minutes,
      status: "pending",
      payment_method: data.payment_method ?? null,
      note: data.note ?? null,
      source: data.source ?? null,
      estimated_total: estimatedTotal,
      created_by: me?.id ?? null,
    })
    .select("id")
    .single();

  const orderRow = order as { id: string } | null;
  if (orderErr || !orderRow) {
    return { ok: false, error: orderErr?.message ?? "建立訂單失敗" };
  }

  if (data.items.length > 0) {
    const { error } = await supabase.from("order_items").insert(
      data.items.map((it) => ({
        order_id: orderRow.id,
        // 機器資訊改由師傅到現場補填
        machine_id: null,
        service_item_id: it.service_item_id,
        // 新訂單一律未指派師傅（即使表單帶值也清掉），等月曆拖曳指派
        technician_id: null,
        quantity: it.quantity,
        unit_price: it.unit_price,
        subtotal: it.quantity * it.unit_price,
        tag: it.tag ?? null,
        note: it.note ?? null,
      })),
    );
    if (error) return { ok: false, error: `明細寫入失敗：${error.message}` };
  }

  if (data.adjustments.length > 0) {
    const { error } = await supabase.from("order_adjustments").insert(
      data.adjustments.map((a) => ({
        order_id: orderRow.id,
        adjustment_item_id: a.adjustment_item_id ?? null,
        name_snapshot: a.name_snapshot,
        type: a.type,
        amount: a.amount,
        note: a.note ?? null,
      })),
    );
    if (error) return { ok: false, error: `加減項寫入失敗：${error.message}` };
  }

  revalidatePath("/orders");
  revalidatePath("/calendar");
  return { ok: true, id: orderRow.id };
}

export async function updateOrderAction(
  id: string,
  input: OrderInput,
): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const parsed = OrderSchema.safeParse(input);
  if (!parsed.success) {
    return { ok: false, error: parsed.error.issues[0]?.message ?? "資料錯誤" };
  }
  const data = parsed.data;
  const supabase = await createClient();

  const { error: upErr } = await supabase
    .from("orders")
    .update({
      customer_id: data.customer_id,
      address_id: data.address_id,
      scheduled_at: data.scheduled_at || null,
      scheduled_end_at: data.scheduled_end_at || null,
      service_at: data.service_at || null,
      duration_minutes: data.duration_minutes,
      status: data.status,
      payment_method: data.payment_method ?? null,
      note: data.note ?? null,
      source: data.source ?? null,
    })
    .eq("id", id);
  if (upErr) return { ok: false, error: upErr.message };

  // Replace-all items and adjustments
  await supabase.from("order_items").delete().eq("order_id", id);
  if (data.items.length > 0) {
    const { error } = await supabase.from("order_items").insert(
      data.items.map((it) => ({
        order_id: id,
        machine_id: it.machine_id ?? null,
        service_item_id: it.service_item_id,
        technician_id: it.technician_id ?? null,
        quantity: it.quantity,
        unit_price: it.unit_price,
        subtotal: it.quantity * it.unit_price,
        tag: it.tag ?? null,
        note: it.note ?? null,
      })),
    );
    if (error) return { ok: false, error: `明細寫入失敗：${error.message}` };
  }

  await supabase.from("order_adjustments").delete().eq("order_id", id);
  if (data.adjustments.length > 0) {
    const { error } = await supabase.from("order_adjustments").insert(
      data.adjustments.map((a) => ({
        order_id: id,
        adjustment_item_id: a.adjustment_item_id ?? null,
        name_snapshot: a.name_snapshot,
        type: a.type,
        amount: a.amount,
        note: a.note ?? null,
      })),
    );
    if (error) return { ok: false, error: `加減項寫入失敗：${error.message}` };
  }

  revalidatePath("/orders");
  revalidatePath(`/orders/${id}`);
  revalidatePath("/calendar");
  return { ok: true, id };
}

export async function deleteOrderAction(id: string): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase.from("orders").delete().eq("id", id);
  if (error) return { ok: false, error: error.message };
  await logAudit({ action: "order.delete", target_type: "order", target_id: id });
  revalidatePath("/orders");
  revalidatePath("/calendar");
  // 不再 redirect，交給呼叫端決定（編輯頁要跳列表、列表頁要保持當前 filter）
  return { ok: true };
}

/**
 * Drag a pending order from the calendar's pending panel onto a date.
 * - Sets scheduled_at / scheduled_end_at
 * - Flips status from "pending" to "scheduled"
 * - If technicianId provided (active tech tab), reassigns ALL order_items
 */
export async function quickScheduleAction(input: {
  orderId: string;
  startIso: string;
  endIso: string;
  technicianId?: string | null;
}): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();

  const { error: oErr } = await supabase
    .from("orders")
    .update({
      scheduled_at: input.startIso,
      scheduled_end_at: input.endIso,
      status: "scheduled",
    })
    .eq("id", input.orderId);
  if (oErr) return { ok: false, error: oErr.message };

  if (input.technicianId) {
    const { error: iErr } = await supabase
      .from("order_items")
      .update({ technician_id: input.technicianId })
      .eq("order_id", input.orderId);
    if (iErr) return { ok: false, error: iErr.message };
  }

  revalidatePath("/calendar");
  revalidatePath("/orders");
  revalidatePath("/dashboard");
  return { ok: true };
}

/** Move an order to a new scheduled date (used by calendar drag-and-drop). */
export async function rescheduleOrderAction(
  id: string,
  startIso: string,
  endIso?: string,
): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const payload: Record<string, string | null> = { scheduled_at: startIso };
  if (endIso !== undefined) payload.scheduled_end_at = endIso;
  const { error } = await supabase.from("orders").update(payload).eq("id", id);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/calendar");
  revalidatePath(`/orders/${id}`);
  return { ok: true };
}

async function technicianOwnsOrder(orderId: string, userId: string) {
  const supabase = await createClient();
  const { data } = await supabase
    .from("order_items")
    .select("id")
    .eq("order_id", orderId)
    .eq("technician_id", userId)
    .limit(1);
  return Array.isArray(data) && data.length > 0;
}

/** Update an order's payment method (used by staff PWA when collecting cash). */
export async function setPaymentMethodAction(
  orderId: string,
  method: "unpaid" | "cash" | "transfer" | "card" | "line_pay",
): Promise<Res> {
  const me = await requireRole(["owner", "manager", "technician"]);
  if (me.profile.role === "technician") {
    const owns = await technicianOwnsOrder(orderId, me.id);
    if (!owns) return { ok: false, error: "不是你的訂單" };
  }
  // Use admin client because technician role lacks UPDATE on orders via RLS
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ payment_method: method })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff");
  revalidatePath(`/staff/order/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/payroll/settlements");
  return { ok: true };
}

/** Mark order as done (technician completes the job). */
export async function completeOrderAction(
  orderId: string,
  extra?: { service_tags?: string[]; service_notes?: string | null },
): Promise<Res> {
  const me = await requireRole(["owner", "manager", "technician"]);
  if (me.profile.role === "technician") {
    const owns = await technicianOwnsOrder(orderId, me.id);
    if (!owns) return { ok: false, error: "不是你的訂單" };
  }
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const update: {
    status: "done";
    service_at: string;
    service_tags?: string[];
    service_notes?: string | null;
  } = {
    status: "done",
    service_at: new Date().toISOString(),
  };
  if (extra?.service_tags) {
    update.service_tags = extra.service_tags.slice(0, 30);
  }
  if (extra?.service_notes !== undefined) {
    const trimmed = (extra.service_notes ?? "").trim();
    update.service_notes = trimmed.length === 0 ? null : trimmed.slice(0, 2000);
  }
  const { error } = await admin.from("orders").update(update).eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff");
  revalidatePath(`/staff/order/${orderId}`);
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/calendar");
  return { ok: true };
}

/** Update service tags / notes on an existing order (no status change). */
export async function updateServiceNotesAction(
  orderId: string,
  patch: { service_tags: string[]; service_notes: string | null },
): Promise<Res> {
  const me = await requireRole(["owner", "manager", "technician"]);
  if (me.profile.role === "technician") {
    const owns = await technicianOwnsOrder(orderId, me.id);
    if (!owns) return { ok: false, error: "不是你的訂單" };
  }
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const trimmed = (patch.service_notes ?? "").trim();
  const { error } = await admin
    .from("orders")
    .update({
      service_tags: patch.service_tags.slice(0, 30),
      service_notes: trimmed.length === 0 ? null : trimmed.slice(0, 2000),
    })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff");
  revalidatePath(`/staff/order/${orderId}`);
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

/**
 * 新增訂單促銷積分紀錄。
 * 預設歸屬訂單第一位師傅，可由 UI 帶 creditedTo 指定。
 * 取 promotion_types.points 當下值寫入 points_snapshot。
 */
export async function addOrderPromotionAction(
  orderId: string,
  promotionTypeId: string,
  creditedTo: string | null,
): Promise<Res> {
  const me = await requireRole(["owner", "manager", "technician"]);
  const supabase = await createClient();

  // 取目前分值
  const { data: pt } = await supabase
    .from("promotion_types")
    .select("points, label, active")
    .eq("id", promotionTypeId)
    .single();
  if (!pt) return { ok: false, error: "找不到該促銷類型" };
  if (!(pt as { active: boolean }).active)
    return { ok: false, error: "此促銷類型已停用" };

  // 決定歸屬師傅：技師強制歸屬自己（RLS 也會擋）；管理者可指定
  let credit = creditedTo;
  if (me.profile.role === "technician") {
    credit = me.id;
  } else if (!credit) {
    const { data: items } = await supabase
      .from("order_items")
      .select("technician_id, created_at")
      .eq("order_id", orderId)
      .not("technician_id", "is", null)
      .order("created_at", { ascending: true })
      .limit(1);
    credit = (items?.[0] as { technician_id: string } | undefined)?.technician_id ?? null;
  }

  const { error } = await supabase.from("order_promotions").insert({
    order_id: orderId,
    promotion_type_id: promotionTypeId,
    credited_to: credit,
    points_snapshot: (pt as { points: number }).points,
  });
  if (error) return { ok: false, error: error.message };
  await logAudit({
    action: "order.add_promotion",
    target_type: "order",
    target_id: orderId,
    payload: {
      promotion_type_id: promotionTypeId,
      label: (pt as { label: string }).label,
      credited_to: credit,
    },
  });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath(`/staff/order/${orderId}`);
  revalidatePath("/staff");
  revalidatePath("/staff/scores");
  revalidatePath("/scores");
  return { ok: true };
}

/** 移除一筆促銷積分紀錄（technician 只能刪自己的，由 RLS 強制） */
export async function removeOrderPromotionAction(
  orderPromotionId: string,
): Promise<Res> {
  await requireRole(["owner", "manager", "technician"]);
  const supabase = await createClient();
  // 取 order_id 給 revalidate
  const { data: row } = await supabase
    .from("order_promotions")
    .select("order_id")
    .eq("id", orderPromotionId)
    .single();
  const { error } = await supabase
    .from("order_promotions")
    .delete()
    .eq("id", orderPromotionId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    action: "order.remove_promotion",
    target_type: "order_promotion",
    target_id: orderPromotionId,
  });
  const orderId = (row as { order_id: string } | null)?.order_id;
  if (orderId) {
    revalidatePath(`/orders/${orderId}`);
    revalidatePath(`/staff/order/${orderId}`);
  }
  revalidatePath("/staff");
  revalidatePath("/staff/scores");
  revalidatePath("/scores");
  return { ok: true };
}

/** 變更某筆促銷積分的歸屬師傅 */
export async function updateOrderPromotionCreditAction(
  orderPromotionId: string,
  creditedTo: string,
): Promise<Res> {
  await requireRole(["owner", "manager"]);
  if (!creditedTo) return { ok: false, error: "請選擇師傅" };
  const supabase = await createClient();
  const { data: row, error } = await supabase
    .from("order_promotions")
    .update({ credited_to: creditedTo })
    .eq("id", orderPromotionId)
    .select("order_id")
    .single();
  if (error) return { ok: false, error: error.message };
  await logAudit({
    action: "order.update_promotion_credit",
    target_type: "order_promotion",
    target_id: orderPromotionId,
    payload: { credited_to: creditedTo },
  });
  const orderId = (row as { order_id: string } | null)?.order_id;
  if (orderId) revalidatePath(`/orders/${orderId}`);
  revalidatePath("/staff/scores");
  revalidatePath("/scores");
  return { ok: true };
}

/** Add an adjustment (addon/discount) to an order — accessible to technicians on their own orders. */
export async function addOrderAdjustmentAction(
  orderId: string,
  payload: {
    adjustment_item_id?: string | null;
    name_snapshot: string;
    type: "addon" | "discount";
    amount: number;
  },
): Promise<Res & { realId?: string }> {
  const me = await requireRole(["owner", "manager", "technician"]);
  if (me.profile.role === "technician") {
    const owns = await technicianOwnsOrder(orderId, me.id);
    if (!owns) return { ok: false, error: "不是你的訂單" };
  }
  const name = payload.name_snapshot.trim();
  if (!name) return { ok: false, error: "請填項目名稱" };
  if (payload.amount < 0) return { ok: false, error: "金額不可為負數" };

  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { data: inserted, error } = await admin
    .from("order_adjustments")
    .insert({
      order_id: orderId,
      adjustment_item_id: payload.adjustment_item_id ?? null,
      name_snapshot: name,
      type: payload.type,
      amount: payload.amount,
    })
    .select("id")
    .single();
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/staff/order/${orderId}`);
  revalidatePath(`/orders/${orderId}`);
  return { ok: true, realId: (inserted as { id: string }).id };
}

/** Remove an adjustment — accessible to technicians on their own orders. */
export async function removeOrderAdjustmentAction(
  adjustmentId: string,
  orderId: string,
): Promise<Res> {
  const me = await requireRole(["owner", "manager", "technician"]);
  if (me.profile.role === "technician") {
    const owns = await technicianOwnsOrder(orderId, me.id);
    if (!owns) return { ok: false, error: "不是你的訂單" };
  }
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin
    .from("order_adjustments")
    .delete()
    .eq("id", adjustmentId)
    .eq("order_id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath(`/staff/order/${orderId}`);
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
}

/** Mark a batch of orders as settled (老闆娘 收到師傅回繳現金). */
export async function settleOrdersAction(orderIds: string[]): Promise<Res> {
  await requireRole(["owner", "manager"]);
  if (orderIds.length === 0) return { ok: false, error: "未選擇訂單" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ settlement_status: "settled" })
    .in("id", orderIds);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    action: "settlement.bulk_settle",
    target_type: "order",
    payload: { ids: orderIds, count: orderIds.length },
  });
  revalidatePath("/payroll/settlements");
  revalidatePath("/orders");
  return { ok: true };
}

/** Revert a settled order back to pending (if 對帳發現錯誤). */
export async function unsettleOrderAction(orderId: string): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ settlement_status: "pending" })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/payroll/settlements");
  return { ok: true };
}
