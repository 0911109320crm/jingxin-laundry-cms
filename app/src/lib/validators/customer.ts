import { z } from "zod";

// 機器類型（細分；2026-05-31 與建單分類 / 品牌主檔 category 統一）。
// 顧客 / 師傅新增機器的下拉就用這組。需先套用 migration 0027（machine_type enum 新值）。
export const MACHINE_TYPES = [
  "washing_vertical",
  "washing_twin_tub",
  "washing_drum",
  "ac_split",
  "ac_hidden",
  "mattress",
  "sofa",
  "other",
] as const;

// 舊資料相容值：不在新下拉，但顯示與驗證仍要認得（既有機器用這些；無法自動判斷直立/滾筒）。
export const LEGACY_MACHINE_TYPES = ["washing_machine", "air_conditioner"] as const;

// zod 驗證用：新值 + 舊值都接受 → 編輯舊機器存檔不會被擋。
export const ALL_MACHINE_TYPES = [
  ...MACHINE_TYPES,
  ...LEGACY_MACHINE_TYPES,
] as const;

export const MACHINE_TYPE_LABEL: Record<string, string> = {
  washing_vertical: "直立式洗衣機",
  washing_twin_tub: "雙槽式洗衣機",
  washing_drum: "滾筒式洗衣機",
  ac_split: "分離式冷氣",
  ac_hidden: "吊隱式冷氣",
  mattress: "床墊",
  sofa: "沙發",
  other: "其他",
  // 舊資料（既有匯入機器）
  washing_machine: "洗衣機（待分類）",
  air_conditioner: "冷氣（待分類）",
};

export const AddressSchema = z.object({
  id: z.string().uuid().optional(),
  county: z.string().min(1, "請填縣市"),
  district: z.string().min(1, "請填鄉鎮市區"),
  address: z.string().min(1, "請填詳細地址"),
  label: z.string().optional().nullable(),
  is_default: z.boolean(),
});

export const PhoneSchema = z.object({
  id: z.string().uuid().optional(),
  phone: z.string().min(7, "電話太短").max(20, "電話太長"),
  label: z.string().max(20).optional().nullable(),
  is_primary: z.boolean(),
});

export const MachineSchema = z.object({
  id: z.string().uuid().optional(),
  // 接受新細分值 + 舊值（編輯既有機器才不會被擋）
  type: z.enum(ALL_MACHINE_TYPES),
  brand: z.string().optional().nullable(),
  model: z.string().optional().nullable(),
  sub_type: z.string().optional().nullable(),
  note: z.string().optional().nullable(),
  address_id: z
    .string()
    .uuid()
    .nullable()
    .optional()
    .or(z.literal("").transform(() => null)),
});

export const CustomerSchema = z
  .object({
    id: z.string().uuid().optional(),
    code: z
      .string()
      .min(1, "請填顧客編號")
      .max(40, "編號太長")
      .regex(/^[A-Za-z0-9_\-]+$/, "編號只能用英數、_、-"),
    name: z.string().min(1, "請填姓名").max(40),
    source_id: z.string().uuid().optional().nullable(),
    referrer_id: z
      .string()
      .uuid()
      .nullable()
      .optional()
      .or(z.literal("").transform(() => null)),
    note: z.string().optional().nullable(),
    joined_at: z.string().optional().nullable(),
    phones: z.array(PhoneSchema).min(1, "至少一支電話"),
    addresses: z.array(AddressSchema).min(1, "至少一個地址"),
    machines: z.array(MachineSchema),
  })
  .superRefine((data, ctx) => {
    const primaryCount = data.phones.filter((p) => p.is_primary).length;
    if (primaryCount === 0) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phones"],
        message: "請指定一支主要電話",
      });
    } else if (primaryCount > 1) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ["phones"],
        message: "只能有一支主要電話",
      });
    }
    // 同一客戶電話不能重複
    const seen = new Set<string>();
    for (let i = 0; i < data.phones.length; i++) {
      const normalized = data.phones[i].phone.replace(/\D/g, "");
      if (seen.has(normalized)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ["phones", i, "phone"],
          message: "與上方電話重複",
        });
      }
      seen.add(normalized);
    }
  });

export type CustomerInput = z.infer<typeof CustomerSchema>;
export type AddressInput = z.infer<typeof AddressSchema>;
export type MachineInput = z.infer<typeof MachineSchema>;
export type PhoneInput = z.infer<typeof PhoneSchema>;
