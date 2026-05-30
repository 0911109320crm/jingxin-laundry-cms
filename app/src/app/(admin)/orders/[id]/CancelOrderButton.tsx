"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { XCircle } from "lucide-react";
import { cancelOrderAction } from "@/app/(admin)/orders/actions";
import { Button } from "@/components/ui/Button";

const PRESET_REASONS = [
  "客戶來電取消",
  "客戶改期",
  "重複下單",
  "建錯單",
  "聯絡不上客戶",
];

/**
 * 取消訂單（軟取消）：填原因 → status=cancelled，資料保留、歸入「已取消」分頁。
 * 取代硬刪除——老闆娘日常「這單不做了」一律走這裡，不會破壞薪資/報表，也救得回。
 */
export function CancelOrderButton({
  id,
  orderCode,
}: {
  id: string;
  orderCode: string;
}) {
  const [open, setOpen] = useState(false);
  const [reason, setReason] = useState("");
  const [pending, startTransition] = useTransition();
  const router = useRouter();

  const submit = () => {
    const r = reason.trim();
    if (!r) {
      alert("請點選或填寫取消原因");
      return;
    }
    startTransition(async () => {
      const res = await cancelOrderAction(id, r);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setOpen(false);
      router.refresh();
    });
  };

  return (
    <>
      <Button type="button" variant="outline" onClick={() => setOpen(true)}>
        <XCircle className="h-4 w-4" /> 取消訂單
      </Button>

      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => !pending && setOpen(false)}
          />
          <div className="relative w-full max-w-sm space-y-4 rounded-2xl bg-white p-5 shadow-2xl">
            <div>
              <h2 className="text-base font-bold text-zinc-900">
                取消訂單 {orderCode}
              </h2>
              <p className="mt-1 text-xs text-zinc-500">
                取消後訂單會移到「已取消」分頁，<b>資料保留、可追溯、不會永久消失</b>，日後也查得到。
              </p>
            </div>

            <div className="flex flex-wrap gap-1.5">
              {PRESET_REASONS.map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setReason(p)}
                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                    reason === p
                      ? "border-brand-600 bg-brand-600 text-white"
                      : "border-zinc-300 text-zinc-700 hover:bg-zinc-50"
                  }`}
                >
                  {p}
                </button>
              ))}
            </div>

            <textarea
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              placeholder="取消原因（可點上方常用原因，或自行輸入）"
              className="min-h-[70px] w-full rounded-lg border border-zinc-300 px-3 py-2 text-sm focus:border-brand-500 focus:outline-none"
              maxLength={200}
            />

            <div className="flex justify-end gap-2">
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setOpen(false)}
              >
                返回
              </Button>
              <Button
                type="button"
                variant="danger"
                disabled={pending}
                onClick={submit}
              >
                {pending ? "處理中…" : "確認取消訂單"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
