/**
 * Placeholder for Supabase generated types.
 *
 * After provisioning the Supabase project, regenerate via:
 *   npx supabase gen types typescript --project-id <project-ref> > src/types/database.ts
 *
 * The placeholder uses unknown rows so the Supabase client still type-checks
 * without flooding compile errors before the real schema is connected.
 */

export type UserRole = "owner" | "manager" | "technician";
export type MachineType =
  // 細分（2026-05-31）
  | "washing_vertical"
  | "washing_twin_tub"
  | "washing_drum"
  | "ac_split"
  | "ac_hidden"
  | "mattress"
  | "sofa"
  | "other"
  // 舊資料相容
  | "washing_machine"
  | "air_conditioner";
export type AdjustmentType = "discount" | "addon";
export type OrderStatus =
  | "pending"
  | "scheduled"
  | "in_progress"
  | "done"
  | "cancelled";
export type PaymentMethod =
  | "cash"
  | "transfer"
  | "card"
  | "line_pay"
  | "unpaid";
export type ReminderType = "annual_due";
export type ReminderStatus = "pending" | "sent" | "skipped";

type GenericTable = {
  Row: Record<string, unknown>;
  Insert: Record<string, unknown>;
  Update: Record<string, unknown>;
};

export type Database = {
  public: {
    Tables: {
      user_profiles: GenericTable;
      customer_sources: GenericTable;
      customers: GenericTable;
      customer_addresses: GenericTable;
      machines: GenericTable;
      service_items: GenericTable;
      adjustment_items: GenericTable;
      orders: GenericTable;
      order_items: GenericTable;
      order_adjustments: GenericTable;
      reminders: GenericTable;
      import_logs: GenericTable;
      audit_logs: GenericTable;
    };
    Views: Record<string, never>;
    Functions: {
      current_role: { Args: Record<string, never>; Returns: UserRole };
      generate_order_code: { Args: { p_date?: string }; Returns: string };
      refresh_order_totals: { Args: { p_order_id: string }; Returns: void };
      refresh_annual_reminders: { Args: Record<string, never>; Returns: number };
    };
    Enums: {
      user_role: UserRole;
      machine_type: MachineType;
      adjustment_type: AdjustmentType;
      order_status: OrderStatus;
      payment_method: PaymentMethod;
      reminder_type: ReminderType;
      reminder_status: ReminderStatus;
    };
  };
};

export type UserProfile = {
  id: string;
  name: string;
  phone: string | null;
  role: UserRole;
  active: boolean;
  /** 查帳唯讀帳號：擋下所有寫入。 */
  readonly?: boolean;
  /** 資料日期下限（查帳用）：只看得到此日期(含)以後的顧客/訂單。 */
  data_floor_date?: string | null;
  /** 師傅可唯讀檢視所有師傅排班（給身為老闆的師傅）。 */
  can_view_all?: boolean;
};
