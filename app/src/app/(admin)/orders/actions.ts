"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import { requireRole, getCurrentUser } from "@/lib/dal";
import { OrderSchema, type OrderInput } from "@/lib/validators/order";

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
      .select("id, type, brand, model, sub_type, note")
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
    }[] | null) ?? [],
  };
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
  revalidatePath("/calendar");
  revalidatePath("/orders");
  revalidatePath(`/orders/${orderId}`);
  return { ok: true };
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

  const { data: order, error: orderErr } = await supabase
    .from("orders")
    .insert({
      order_code,
      customer_id: data.customer_id,
      address_id: data.address_id,
      scheduled_at: data.scheduled_at || null,
      scheduled_end_at: data.scheduled_end_at || null,
      service_at: data.service_at || null,
      status: data.status,
      payment_method: data.payment_method ?? null,
      note: data.note ?? null,
      source: data.source ?? null,
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
  revalidatePath("/orders");
  revalidatePath("/calendar");
  redirect("/orders");
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
export async function completeOrderAction(orderId: string): Promise<Res> {
  const me = await requireRole(["owner", "manager", "technician"]);
  if (me.profile.role === "technician") {
    const owns = await technicianOwnsOrder(orderId, me.id);
    if (!owns) return { ok: false, error: "不是你的訂單" };
  }
  const { createAdminClient } = await import("@/lib/supabase/admin");
  const admin = createAdminClient();
  const { error } = await admin
    .from("orders")
    .update({ status: "done", service_at: new Date().toISOString() })
    .eq("id", orderId);
  if (error) return { ok: false, error: error.message };
  revalidatePath("/staff");
  revalidatePath(`/staff/order/${orderId}`);
  revalidatePath("/orders");
  revalidatePath("/calendar");
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
