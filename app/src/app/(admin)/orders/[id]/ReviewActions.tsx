"use client";

import { useState, useTransition } from "react";
import { Star, X } from "lucide-react";
import {
  markOrderReviewedAction,
  unmarkOrderReviewedAction,
} from "@/app/(admin)/orders/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Select } from "@/components/ui/Select";

export function ReviewActions({
  orderId,
  isReviewed,
  reviewedAt,
  creditedTo,
  defaultTechnicianId,
  technicians,
  techMap,
}: {
  orderId: string;
  isReviewed: boolean;
  reviewedAt: string | null;
  creditedTo: string | null;
  /** 訂單第一位師傅 id（預設歸屬） */
  defaultTechnicianId: string | null;
  technicians: { id: string; name: string }[];
  techMap: Record<string, string>;
}) {
  const [open, setOpen] = useState(false);
  const [chosen, setChosen] = useState<string>(
    defaultTechnicianId ?? technicians[0]?.id ?? "",
  );
  const [pending, startTransition] = useTransition();

  const submit = () => {
    if (!chosen) {
      alert("請選擇歸屬師傅");
      return;
    }
    startTransition(async () => {
      const res = await markOrderReviewedAction(orderId, chosen);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setOpen(false);
    });
  };

  const unmark = () => {
    if (!confirm("確認取消「已獲五星好評」標記？")) return;
    startTransition(async () => {
      const res = await unmarkOrderReviewedAction(orderId);
      if (!res.ok) alert(res.error);
    });
  };

  if (isReviewed) {
    return (
      <Card className="border-yellow-300 bg-gradient-to-br from-yellow-50 to-amber-50">
        <CardHeader className="flex items-center justify-between">
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 fill-yellow-500 text-yellow-500" />
            客戶已留下 Google 五星好評
          </CardTitle>
          <button
            type="button"
            onClick={unmark}
            disabled={pending}
            className="rounded px-2 py-1 text-xs text-zinc-500 hover:bg-white"
          >
            取消標記
          </button>
        </CardHeader>
        <CardBody className="space-y-1 text-sm">
          <p className="text-zinc-700">
            積分歸屬：
            <span className="font-semibold text-zinc-900">
              {creditedTo ? techMap[creditedTo] ?? "（已離職師傅）" : "—"}
            </span>
          </p>
          {reviewedAt && (
            <p className="text-xs text-zinc-500">
              標記時間：{new Date(reviewedAt).toLocaleString("zh-TW")}
            </p>
          )}
        </CardBody>
      </Card>
    );
  }

  return (
    <>
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Star className="h-5 w-5 text-zinc-400" />
            Google 五星好評
          </CardTitle>
        </CardHeader>
        <CardBody>
          <p className="mb-3 text-sm text-zinc-600">
            老闆娘看到客戶在 Google 留下五星好評後，按此標記，記師傅一筆積分。
          </p>
          <Button
            type="button"
            onClick={() => setOpen(true)}
            disabled={pending}
            className="bg-yellow-500 hover:bg-yellow-600"
          >
            <Star className="h-4 w-4" /> 標記為已獲五星好評
          </Button>
        </CardBody>
      </Card>

      {open && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center px-4"
          onClick={() => !pending && setOpen(false)}
        >
          <div className="absolute inset-0 bg-black/40" />
          <div
            className="relative w-full max-w-sm rounded-2xl bg-white shadow-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between border-b border-zinc-200 px-4 py-3">
              <h2 className="text-base font-bold text-zinc-900">
                標記五星好評
              </h2>
              <button
                type="button"
                onClick={() => setOpen(false)}
                disabled={pending}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3 px-4 py-4">
              <label className="block text-sm font-medium text-zinc-800">
                積分歸屬給：
              </label>
              <Select
                value={chosen}
                onChange={(e) => setChosen(e.target.value)}
              >
                <option value="">— 選擇師傅 —</option>
                {technicians.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name}
                    {t.id === defaultTechnicianId ? "（本案師傅）" : ""}
                  </option>
                ))}
              </Select>
              <p className="text-xs text-zinc-500">
                預設為本案派工師傅，必要時可改為別人
              </p>
            </div>
            <div className="flex items-center justify-end gap-2 border-t border-zinc-200 px-4 py-3">
              <Button
                type="button"
                variant="ghost"
                onClick={() => setOpen(false)}
                disabled={pending}
              >
                取消
              </Button>
              <Button
                type="button"
                onClick={submit}
                disabled={pending}
                className="bg-yellow-500 hover:bg-yellow-600"
              >
                {pending ? "儲存中…" : "確認"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
