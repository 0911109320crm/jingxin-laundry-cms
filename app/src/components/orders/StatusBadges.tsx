import { cn } from "@/lib/utils";
import {
  ORDER_STATUS_LABEL,
  PAYMENT_METHOD_LABEL,
  SETTLEMENT_STATUS_LABEL,
} from "@/lib/validators/order";

type Status = string;
type Payment = keyof typeof PAYMENT_METHOD_LABEL;
type Settlement = keyof typeof SETTLEMENT_STATUS_LABEL;

const STATUS_COLOR: Record<string, string> = {
  pending: "bg-zinc-100 text-zinc-700",
  scheduled: "bg-blue-50 text-blue-700",
  in_progress: "bg-amber-50 text-amber-700",
  done: "bg-green-50 text-green-700",
  cancelled: "bg-zinc-100 text-zinc-400 line-through",
};

const PAYMENT_COLOR: Record<Payment, string> = {
  unpaid: "bg-red-50 text-red-700 ring-1 ring-red-200",
  cash: "bg-green-50 text-green-700",
  transfer: "bg-emerald-50 text-emerald-700",
  card: "bg-emerald-50 text-emerald-700",
  line_pay: "bg-emerald-50 text-emerald-700",
};

const SETTLEMENT_COLOR: Record<Settlement, string> = {
  pending: "bg-amber-50 text-amber-700 ring-1 ring-amber-200",
  settled: "bg-zinc-100 text-zinc-600",
  not_required: "bg-zinc-50 text-zinc-400",
};

export function StatusBadge({ value }: { value: Status }) {
  return (
    <span
      className={cn(
        "rounded px-2 py-0.5 text-xs font-medium",
        STATUS_COLOR[value] ?? "bg-zinc-100 text-zinc-700",
      )}
    >
      {ORDER_STATUS_LABEL[value] ?? value}
    </span>
  );
}

export function PaymentBadge({ value }: { value: Payment }) {
  return (
    <span
      className={cn(
        "rounded px-2 py-0.5 text-xs font-medium",
        PAYMENT_COLOR[value],
      )}
    >
      {PAYMENT_METHOD_LABEL[value]}
    </span>
  );
}

// 「待回繳」是現金語意（師傅手上有現金要交回）。匯款/刷卡/LINE Pay 沒有現金在師傅手上，
// 錢直接進公司帳戶，pending 真正的意思是「老闆娘還沒對帳確認入帳」，所以這些付款方式顯示「待對帳」。
const NONCASH_PENDING = new Set<Payment>(["transfer", "card", "line_pay"]);

export function SettlementBadge({
  value,
  payment,
}: {
  value: Settlement;
  payment?: Payment;
}) {
  const label =
    value === "pending" && payment && NONCASH_PENDING.has(payment)
      ? "待對帳"
      : SETTLEMENT_STATUS_LABEL[value];
  return (
    <span
      className={cn(
        "rounded px-2 py-0.5 text-xs font-medium",
        SETTLEMENT_COLOR[value],
      )}
    >
      {label}
    </span>
  );
}
