"use client";

import { useTransition } from "react";
import { Star, Check } from "lucide-react";
import {
  addOrderPromotionAction,
  removeOrderPromotionAction,
} from "@/app/(admin)/orders/actions";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";

type PromotionType = { id: string; code: string; label: string; points: number };
type OrderPromotion = { id: string; promotion_type_id: string; points_snapshot: number };

export function PromotionsToggle({
  orderId,
  promotionTypes,
  myPromotions,
  myUserId,
}: {
  orderId: string;
  promotionTypes: PromotionType[];
  /** 本訂單上「歸屬給我」的促銷紀錄 */
  myPromotions: OrderPromotion[];
  myUserId: string;
}) {
  const [pending, startTransition] = useTransition();
  const activeMap = new Map(myPromotions.map((p) => [p.promotion_type_id, p]));
  const totalPoints = myPromotions.reduce((s, p) => s + p.points_snapshot, 0);

  const toggle = (typeId: string) => {
    const existing = activeMap.get(typeId);
    startTransition(async () => {
      if (existing) {
        const res = await removeOrderPromotionAction(existing.id);
        if (!res.ok) alert(res.error);
      } else {
        const res = await addOrderPromotionAction(orderId, typeId, myUserId);
        if (!res.ok) alert(res.error);
      }
    });
  };

  return (
    <Card className={totalPoints > 0 ? "border-amber-300 bg-amber-50" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Star className={`h-5 w-5 ${totalPoints > 0 ? "fill-amber-500 text-amber-500" : "text-zinc-400"}`} />
            促銷積分
          </span>
          <span className="font-mono text-base font-bold text-amber-700">
            +{totalPoints} 分
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-1.5">
        <p className="text-xs text-zinc-600">
          客戶完成促銷動作後，勾選對應項目即計分。再次點擊可取消。
        </p>
        <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
          {promotionTypes.map((t) => {
            const active = activeMap.has(t.id);
            return (
              <button
                key={t.id}
                type="button"
                onClick={() => toggle(t.id)}
                disabled={pending}
                className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                  active
                    ? "border-amber-500 bg-amber-100 text-amber-900"
                    : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                }`}
              >
                <span className="flex items-center gap-2">
                  {active && <Check className="h-4 w-4 text-amber-700" />}
                  <span className={active ? "font-medium" : ""}>{t.label}</span>
                </span>
                <span className={`font-mono text-xs font-bold ${active ? "text-amber-700" : "text-zinc-500"}`}>
                  +{t.points}
                </span>
              </button>
            );
          })}
        </div>
      </CardBody>
    </Card>
  );
}
