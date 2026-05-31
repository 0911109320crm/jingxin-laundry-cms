"use client";

import { useTransition } from "react";
import { Trash2, Plus, Star } from "lucide-react";
import {
  addOrderPromotionAction,
  removeOrderPromotionAction,
  updateOrderPromotionCreditAction,
} from "@/app/(admin)/orders/actions";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Button } from "@/components/ui/Button";
import { Select } from "@/components/ui/Select";

export type PromotionType = {
  id: string;
  code: string;
  label: string;
  points: number;
};

export type OrderPromotion = {
  id: string;
  promotion_type_id: string;
  credited_to: string | null;
  points_snapshot: number;
};

export function PromotionsPanel({
  orderId,
  promotions,
  promotionTypes,
  technicians,
  defaultTechnicianId,
}: {
  orderId: string;
  promotions: OrderPromotion[];
  promotionTypes: PromotionType[];
  technicians: { id: string; name: string }[];
  defaultTechnicianId: string | null;
}) {
  const [pending, startTransition] = useTransition();

  const usedTypeIds = new Set(promotions.map((p) => p.promotion_type_id));
  const availableTypes = promotionTypes.filter((t) => !usedTypeIds.has(t.id));
  const totalPoints = promotions.reduce((s, p) => s + p.points_snapshot, 0);

  const add = (promotionTypeId: string) => {
    startTransition(async () => {
      const res = await addOrderPromotionAction(
        orderId,
        promotionTypeId,
        defaultTechnicianId,
      );
      if (!res.ok) alert(res.error);
    });
  };

  const remove = (id: string) => {
    if (!confirm("移除此筆促銷積分？")) return;
    startTransition(async () => {
      const res = await removeOrderPromotionAction(id);
      if (!res.ok) alert(res.error);
    });
  };

  const changeCredit = (id: string, creditedTo: string) => {
    startTransition(async () => {
      const res = await updateOrderPromotionCreditAction(id, creditedTo);
      if (!res.ok) alert(res.error);
    });
  };

  const typeMap = new Map(promotionTypes.map((t) => [t.id, t]));

  return (
    <Card className={promotions.length > 0 ? "border-amber-300 bg-gradient-to-br from-amber-50 to-amber-100" : ""}>
      <CardHeader>
        <CardTitle className="flex items-center justify-between">
          <span className="flex items-center gap-2">
            <Star className={`h-5 w-5 ${promotions.length > 0 ? "fill-amber-500 text-amber-500" : "text-zinc-400"}`} />
            促銷積分（{promotions.length} 筆 / 共 {totalPoints} 分）
          </span>
        </CardTitle>
      </CardHeader>
      <CardBody className="space-y-3">
        {promotions.length === 0 && (
          <p className="text-sm text-zinc-600">
            尚無紀錄。客戶完成促銷動作（FB按讚 / Google評論等）後可從下方加入。
          </p>
        )}

        {promotions.length > 0 && (
          <ul className="divide-y divide-amber-200 rounded-lg bg-white">
            {promotions.map((p) => {
              const t = typeMap.get(p.promotion_type_id);
              return (
                <li
                  key={p.id}
                  className="grid grid-cols-1 md:grid-cols-[1fr_70px_180px_auto] md:items-center gap-2 px-3 py-2 text-sm"
                >
                  <span className="font-medium text-zinc-900">
                    {t?.label ?? "（已刪除）"}
                  </span>
                  <span className="text-right font-mono font-bold text-amber-700">
                    +{p.points_snapshot} 分
                  </span>
                  <Select
                    value={p.credited_to ?? ""}
                    onChange={(e) => changeCredit(p.id, e.target.value)}
                    disabled={pending}
                  >
                    <option value="">— 選擇歸屬師傅 —</option>
                    {technicians.map((tech) => (
                      <option key={tech.id} value={tech.id}>
                        {tech.name}
                      </option>
                    ))}
                  </Select>
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    onClick={() => remove(p.id)}
                    disabled={pending}
                  >
                    <Trash2 className="h-4 w-4 text-rose-500" />
                  </Button>
                </li>
              );
            })}
          </ul>
        )}

        {availableTypes.length > 0 && (
          <div>
            <p className="mb-1.5 text-xs font-medium text-zinc-600">可新增：</p>
            <div className="flex flex-wrap gap-1.5">
              {availableTypes.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => add(t.id)}
                  disabled={pending}
                  className="inline-flex items-center gap-1 rounded-full border border-zinc-300 bg-white px-3 py-1.5 text-xs text-zinc-700 hover:border-amber-400 hover:bg-amber-50"
                >
                  <Plus className="h-3 w-3" />
                  {t.label}
                  <span className="font-mono text-amber-700">+{t.points}</span>
                </button>
              ))}
            </div>
          </div>
        )}
      </CardBody>
    </Card>
  );
}
