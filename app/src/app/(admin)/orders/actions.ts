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
      .is("merged_into_id", null)
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

  // 訂單狀態判定（老闆娘 2026-05-31 需求調整）：
  //   - 有 scheduled_at + 「所有」服務項目都已指派師傅 → 直接 'scheduled'（已排案）
  //   - 否則 'pending'（待派工，等月曆拖曳補齊師傅）
  // 註：之前是「至少一個」(some)，但部分指派不該算完整派工，改為全部 (every)。
  const allAssigned = data.items.every((it) => it.technician_id);
  const hasScheduled = !!data.scheduled_at;
  const orderStatus = hasScheduled && allAssigned ? "scheduled" : "pending";

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
      status: orderStatus,
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
        // 建單時若老闆娘已知客戶機器可直接帶入（5a）；不知道就留 null 由師傅現場補
        machine_id: it.machine_id ?? null,
        service_item_id: it.service_item_id,
        // 老闆娘 2026-05-27 起允許建單時直接指派師傅
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
  transferLast5?: string,
): Promise<Res> {
  const me = await requireRole(["owner", "manager", "technician"]);
  // 轉帳後五碼：有填就必須是 5 位數字（含前導 0）；留空＝客戶稍後才轉
  const cleanLast5 =
    method === "transfer" && transferLast5 && /^\d{5}$/.test(transferLast5)
      ? transferLast5
      : null;
  if (method === "transfer" && transferLast5 && !cleanLast5) {
    return { ok: false, error: "後五碼請填 5 位數字，或改勾「客戶稍後才轉」" };
  }
  const isTech = me.profile.role === "technician";
  if (isTech) {
    const owns = await technicianOwnsOrder(orderId, me.id);
    if (!owns) return { ok: false, error: "不是你的訂單" };
  }
  // Use admin client because technician role lacks UPDATE on orders via RLS
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();

  const revalidate = () => {
    revalidatePath("/staff");
    revalidatePath(`/staff/order/${orderId}`);
    revalidatePath("/orders");
    revalidatePath(`/orders/${orderId}`);
    revalidatePath("/payroll/settlements");
  };

  // 「改回未收款」(修正用)：已收款後僅收款人本人或老闆娘可動，
  // 避免多師傅同單時別的師傅誤觸、把收款紀錄洗掉。
  if (method === "unpaid") {
    if (isTech) {
      const { data: ord } = await admin
        .from("orders")
        .select("collected_by_technician_id")
        .eq("id", orderId)
        .single();
      const collector = (
        ord as { collected_by_technician_id: string | null } | null
      )?.collected_by_technician_id;
      if (collector && collector !== me.id) {
        return {
          ok: false,
          error: "此單由其他師傅收款，僅收款人本人或老闆娘可改回",
        };
      }
    }
    const { error } = await admin
      .from("orders")
      .update({
        payment_method: "unpaid",
        collected_by_technician_id: null,
        transfer_last5: null,
      })
      .eq("id", orderId);
    if (error) return { ok: false, error: error.message };
    revalidate();
    return { ok: true };
  }

  // 收款（現金/匯款等）前的閘門：整單所有「未標記不服務」的品項，
  // 都必須已由負責師傅確認過實際金額，否則不得收款（金額才會正確）。
  const { data: unconfirmed } = await admin
    .from("order_items")
    .select("id")
    .eq("order_id", orderId)
    .eq("excluded", false)
    .eq("confirmed", false)
    .limit(1);
  if (Array.isArray(unconfirmed) && unconfirmed.length > 0) {
    return {
      ok: false,
      error: "尚有師傅未確認金額，請等所有師傅確認後再收款",
    };
  }

  // 原子鎖定：僅當目前仍為「未收款」時才成功，防兩位師傅同時按收款互相覆蓋。
  // 現金才蓋章收款人(=當下收錢的師傅)；匯款/刷卡無現金回繳問題，不設收款人。
  const { data: locked, error } = await admin
    .from("orders")
    .update({
      payment_method: method,
      collected_by_technician_id: method === "cash" ? me.id : null,
      transfer_last5: cleanLast5,
    })
    .eq("id", orderId)
    .eq("payment_method", "unpaid")
    .select("id");
  if (error) return { ok: false, error: error.message };
  if (!locked || locked.length === 0) {
    return { ok: false, error: "此單已由其他人完成收款，請重新整理頁面" };
  }
  revalidate();
  return { ok: true };
}

/**
 * 師傅確認「自己負責品項」的實際金額（多師傅同單收款閘門）。
 * 把登入師傅在此單負責、未標記不服務的品項設為 confirmed。
 * 當整單所有未排除品項都 confirmed，收款鈕才會在最後確認的師傅面前出現。
 */
export async function confirmMyItemsAction(orderId: string): Promise<Res> {
  const me = await requireRole(["owner", "manager", "technician"]);
  if (me.profile.role === "technician") {
    const owns = await technicianOwnsOrder(orderId, me.id);
    if (!owns) return { ok: false, error: "不是你的訂單" };
  }
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  let q = admin
    .from("order_items")
    .update({ confirmed: true })
    .eq("order_id", orderId)
    .eq("excluded", false);
  // 師傅：只確認「指派給我」+「沒指派師傅(現場兜底)」的品項；
  // 老闆娘/manager：確認整單(代為放行，避免有品項沒人能確認導致收款卡死)
  if (me.profile.role === "technician") {
    q = q.or(`technician_id.eq.${me.id},technician_id.is.null`);
  }
  const { error } = await q;
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff");
  revalidatePath(`/staff/order/${orderId}`);
  return { ok: true };
}

/**
 * 老闆娘兜底：代為確認整單所有品項金額（放行收款）。
 * 用於師傅做完忘了在手機確認就離開、導致最後收款師傅卡住收不了款的情況。
 */
export async function confirmAllItemsAction(orderId: string): Promise<Res> {
  await requireRole(["owner", "manager"]);
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin
    .from("order_items")
    .update({ confirmed: true })
    .eq("order_id", orderId)
    .eq("excluded", false);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    action: "settlement.confirm_all_items",
    target_type: "order",
    target_id: orderId,
    payload: {},
  });
  revalidatePath(`/orders/${orderId}`);
  revalidatePath("/staff");
  revalidatePath(`/staff/order/${orderId}`);
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
  revalidatePath("/payroll/transfers");
  revalidatePath("/orders");
  return { ok: true };
}

/**
 * 改某張訂單的現金收款人（老闆娘對帳時修正「這筆其實是誰收的」）。
 *
 * 多師傅同單時，現場誰最後收全款是臨時浮現的、PWA 蓋章未必準；真正的真相來源
 * 是師傅把現金交回老闆娘那一刻。故收款人以對帳頁指定為權威，PWA 蓋章只是預設值。
 */
export async function updateOrderCollectorAction(
  orderId: string,
  technicianId: string,
): Promise<Res> {
  await requireRole(["owner", "manager"]);
  if (!technicianId) return { ok: false, error: "請選擇收款師傅" };
  const supabase = await createClient();
  const { error } = await supabase
    .from("orders")
    .update({ collected_by_technician_id: technicianId })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  await logAudit({
    action: "settlement.update_collector",
    target_type: "order",
    target_id: orderId,
    payload: { collected_by_technician_id: technicianId },
  });
  revalidatePath("/payroll/settlements");
  revalidatePath("/manager/settle-today");
  revalidatePath("/payroll");
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
