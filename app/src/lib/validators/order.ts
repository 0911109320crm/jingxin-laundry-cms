import { z } from "zod";

export const ORDER_STATUSES = [
  "pending",
  "scheduled",
  "done",
  "cancelled",
] as const;

export const ORDER_STATUS_LABEL: Record<string, string> = {
  pending: "待派工",
  scheduled: "已排案",
  in_progress: "進行中", // 保留以防 DB 既有資料；UI 不再讓使用者選擇
  done: "完成",
  cancelled: "取消",
};

export const PAYMENT_METHODS = [
  "unpaid",
  "cash",
  "transfer",
  "card",
  "line_pay",
] as const;

export const PAYMENT_METHOD_LABEL: Record<(typeof PAYMENT_METHODS)[number], string> = {
  unpaid: "未收款",
  cash: "已收款-現金",
  transfer: "已收款-匯款",
  card: "已收款-刷卡",
  line_pay: "已收款-LINE Pay",
};

export const SETTLEMENT_STATUSES = ["pending", "settled", "not_required"] as const;

export const SETTLEMENT_STATUS_LABEL: Record<
  (typeof SETTLEMENT_STATUSES)[number],
  string
> = {
  pending: "待回繳",
  settled: "已回繳",
  not_required: "免回繳",
};

export const OrderItemSchema = z.object({
  id: z.string().uuid().optional(),
  machine_id: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  service_item_id: z.string().uuid("請選服務"),
  technician_id: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  quantity: z.number().int().min(1),
  unit_price: z.number().min(0),
  // 設備資訊：補充服務項目內容的自由文字（原「代號」欄改用途）。欄位本身是 text，無 DB 長度限制。
  tag: z.string().max(50).optional().nullable(),
  note: z.string().optional().nullable(),
});

export const OrderAdjustmentSchema = z.object({
  id: z.string().uuid().optional(),
  adjustment_item_id: z
    .string()
    .uuid()
    .optional()
    .nullable()
    .or(z.literal("").transform(() => null)),
  name_snapshot: z.string().min(1),
  type: z.enum(["discount", "addon"]),
  amount: z.number().min(0),
  note: z.string().optional().nullable(),
});

// Form schema uses string for status to tolerate legacy 'in_progress' values
// but UI only offers the 4 supported choices.
export const OrderSchema = z.object({
  id: z.string().uuid().optional(),
  customer_id: z.string().uuid("請選客戶"),
  address_id: z.string().uuid("請選地址"),
  scheduled_at: z.string().optional().nullable(),
  scheduled_end_at: z.string().optional().nullable(),
  service_at: z.string().optional().nullable(),
  duration_minutes: z.number().int().min(0).max(720),
  status: z.string(),
  payment_method: z.enum(PAYMENT_METHODS),
  note: z.string().optional().nullable(),
  source: z.string().optional().nullable(),
  items: z.array(OrderItemSchema).min(1, "至少一項服務"),
  adjustments: z.array(OrderAdjustmentSchema),
});

export type OrderInput = z.infer<typeof OrderSchema>;
export type OrderItemInput = z.infer<typeof OrderItemSchema>;
export type OrderAdjustmentInput = z.infer<typeof OrderAdjustmentSchema>;
