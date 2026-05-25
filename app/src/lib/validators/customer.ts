import { z } from "zod";

export const MACHINE_TYPES = [
  "washing_machine",
  "air_conditioner",
  "mattress",
  "sofa",
  "other",
] as const;

export const MACHINE_TYPE_LABEL: Record<(typeof MACHINE_TYPES)[number], string> = {
  washing_machine: "洗衣機",
  air_conditioner: "冷氣",
  mattress: "床墊",
  sofa: "沙發",
  other: "其他",
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
  type: z.enum(MACHINE_TYPES),
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
