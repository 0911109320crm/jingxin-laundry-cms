"use client";

import { useState, useTransition } from "react";
import {
  Banknote,
  ArrowDownToLine,
  CheckCircle2,
  X,
  Pencil,
  PlusCircle,
  Trash2,
} from "lucide-react";
import {
  setPaymentMethodAction,
  completeOrderAction,
  updateServiceNotesAction,
  addOrderAdjustmentAction,
  removeOrderAdjustmentAction,
} from "@/app/(admin)/orders/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { Textarea } from "@/components/ui/Textarea";
import { formatNTD } from "@/lib/utils";
import type { OrderInput } from "@/lib/validators/order";

type Method = OrderInput["payment_method"];
type Preset = {
  id: string;
  category: string | null;
  label: string;
  sort_order: number;
};

const CATEGORY_LABEL: Record<string, string> = {
  washing_vertical: "直立式洗衣機",
  washing_drum: "滾筒洗衣機",
  ac_split: "冷氣",
  mattress: "床墊 / 沙發",
};
const CATEGORY_ORDER = ["washing_vertical", "washing_drum", "ac_split", "mattress"];

type Adjustment = {
  id: string;
  name_snapshot: string;
  type: "addon" | "discount";
  amount: number;
};

type AdjustmentItem = {
  id: string;
  name: string;
  type: "addon" | "discount";
  default_amount: number;
};

export function StaffActions({
  orderId,
  currentPayment,
  isDone,
  presets,
  initialTags,
  initialNotes,
  adjustments,
  adjustmentItems,
  subtotal,
  adjustmentsTotal,
  total,
}: {
  orderId: string;
  currentPayment: Method;
  isDone: boolean;
  presets: Preset[];
  initialTags: string[];
  initialNotes: string;
  adjustments: Adjustment[];
  adjustmentItems: AdjustmentItem[];
  subtotal: number;
  adjustmentsTotal: number;
  total: number;
}) {
  const [pending, startTransition] = useTransition();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [dialogMode, setDialogMode] = useState<"complete" | "edit">("complete");
  const [tags, setTags] = useState<string[]>(initialTags);
  const [notes, setNotes] = useState<string>(initialNotes);

  // Local adjustments state — updated optimistically
  const [localAdj, setLocalAdj] = useState<Adjustment[]>(adjustments);
  const [customName, setCustomName] = useState("");
  const [customAmount, setCustomAmount] = useState("");
  const [customType, setCustomType] = useState<"addon" | "discount">("addon");
  const [adjPending, startAdjTransition] = useTransition();

  const localAdjTotal = localAdj.reduce(
    (sum, a) => sum + (a.type === "addon" ? a.amount : -a.amount),
    0,
  );
  const localTotal = subtotal + localAdjTotal;

  const setMethod = (method: Method, label: string) => {
    if (!confirm(`確認改為「${label}」？`)) return;
    startTransition(async () => {
      const res = await setPaymentMethodAction(orderId, method);
      if (!res.ok) alert(res.error);
    });
  };

  const openComplete = () => {
    setDialogMode("complete");
    setTags(initialTags);
    setNotes(initialNotes);
    setLocalAdj(adjustments);
    setDialogOpen(true);
  };

  const openEdit = () => {
    setDialogMode("edit");
    setTags(initialTags);
    setNotes(initialNotes);
    setLocalAdj(adjustments);
    setDialogOpen(true);
  };

  const toggleTag = (label: string) => {
    setTags((prev) =>
      prev.includes(label) ? prev.filter((t) => t !== label) : [...prev, label],
    );
  };

  const submitDialog = () => {
    startTransition(async () => {
      const res =
        dialogMode === "complete"
          ? await completeOrderAction(orderId, {
              service_tags: tags,
              service_notes: notes,
            })
          : await updateServiceNotesAction(orderId, {
              service_tags: tags,
              service_notes: notes,
            });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setDialogOpen(false);
    });
  };

  const addPresetAdj = (item: AdjustmentItem) => {
    startAdjTransition(async () => {
      const res = await addOrderAdjustmentAction(orderId, {
        adjustment_item_id: item.id,
        name_snapshot: item.name,
        type: item.type,
        amount: item.default_amount,
      });
      if (!res.ok) {
        alert(`新增失敗：${res.error}`);
        return;
      }
      setLocalAdj((prev) => [
        ...prev,
        { id: res.realId!, name_snapshot: item.name, type: item.type, amount: item.default_amount },
      ]);
    });
  };

  const addCustomAdj = () => {
    const name = customName.trim();
    const amount = parseInt(customAmount, 10);
    if (!name) { alert("請填項目名稱"); return; }
    if (isNaN(amount) || amount < 0) { alert("請填正確金額"); return; }
    startAdjTransition(async () => {
      const res = await addOrderAdjustmentAction(orderId, {
        name_snapshot: name,
        type: customType,
        amount,
      });
      if (!res.ok) {
        alert(`新增失敗：${res.error}`);
        return;
      }
      setLocalAdj((prev) => [
        ...prev,
        { id: res.realId!, name_snapshot: name, type: customType, amount },
      ]);
      setCustomName("");
      setCustomAmount("");
    });
  };

  const removeAdj = (adj: Adjustment) => {
    // Optimistic remove immediately
    setLocalAdj((prev) => prev.filter((a) => a.id !== adj.id));
    startAdjTransition(async () => {
      const res = await removeOrderAdjustmentAction(adj.id, orderId);
      if (!res.ok) {
        alert(`刪除失敗：${res.error}`);
        // Restore on failure
        setLocalAdj((prev) => [...prev, adj]);
      }
    });
  };

  const presetLabels = new Set(presets.map((p) => p.label));
  const extraTags = tags.filter((t) => !presetLabels.has(t));

  const addonItems = adjustmentItems.filter((a) => a.type === "addon");
  const discountItems = adjustmentItems.filter((a) => a.type === "discount");

  return (
    <>
      <div className="space-y-3">
        <Card>
          <CardHeader>
            <CardTitle>現場操作</CardTitle>
          </CardHeader>
          <CardBody className="space-y-2">
            {currentPayment === "unpaid" && (
              <>
                <Button
                  size="lg"
                  className="w-full"
                  disabled={pending}
                  onClick={() => setMethod("cash", "已收款-現金")}
                >
                  <Banknote className="h-5 w-5" /> 我收到現金了
                </Button>
                <Button
                  size="lg"
                  variant="outline"
                  className="w-full"
                  disabled={pending}
                  onClick={() => setMethod("transfer", "已收款-匯款")}
                >
                  <ArrowDownToLine className="h-5 w-5" /> 客戶說已匯款
                </Button>
              </>
            )}
            {currentPayment === "cash" && (
              <Button
                size="lg"
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={() => setMethod("unpaid", "未收款")}
              >
                改回「未收款」（修正用）
              </Button>
            )}
            {currentPayment === "transfer" && (
              <p className="text-sm text-zinc-500 text-center py-2">
                客戶已匯款，不用收現金
              </p>
            )}
            {!isDone && (
              <Button
                size="lg"
                variant="primary"
                className="w-full bg-green-600 hover:bg-green-700"
                disabled={pending}
                onClick={openComplete}
              >
                <CheckCircle2 className="h-5 w-5" /> 完成此案件
              </Button>
            )}
            {isDone && (
              <>
                <p className="text-center py-2 text-sm font-medium text-green-700">
                  ✓ 已完成
                </p>
                <Button
                  size="md"
                  variant="outline"
                  className="w-full"
                  disabled={pending}
                  onClick={openEdit}
                >
                  <Pencil className="h-4 w-4" /> 補 / 修改備註
                </Button>
              </>
            )}
          </CardBody>
        </Card>
      </div>

      {/* Dialog */}
      {dialogOpen && (
        <div
          className="fixed inset-0 z-50 flex items-end justify-center sm:items-center"
          onClick={() => !pending && setDialogOpen(false)}
        >
          <div className="absolute inset-0 bg-black/50" />
          <div
            className="relative w-full max-w-md max-h-[90vh] overflow-y-auto rounded-t-2xl bg-white shadow-2xl sm:rounded-2xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="sticky top-0 flex items-center justify-between border-b border-zinc-200 bg-white px-4 py-3">
              <h2 className="text-base font-bold text-zinc-900">
                {dialogMode === "complete" ? "完成案件 — 留下備註" : "編輯備註"}
              </h2>
              <button
                type="button"
                onClick={() => setDialogOpen(false)}
                disabled={pending}
                className="rounded p-1 text-zinc-400 hover:bg-zinc-100"
              >
                <X className="h-5 w-5" />
              </button>
            </div>

            <div className="space-y-4 px-4 py-4">
              {dialogMode === "complete" && (
                <p className="text-xs text-zinc-500">
                  日後若不同師傅再接這位客戶，會看到這裡的備註。請花 10 秒留下重點。
                </p>
              )}

              {/* Money summary */}
              <section className="rounded-md bg-zinc-50 p-3">
                {localAdj.length > 0 && (
                  <>
                    <div className="flex items-center justify-between text-sm text-zinc-600">
                      <span>項目小計</span>
                      <span className="font-mono">{formatNTD(subtotal)}</span>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {localAdj.map((a) => (
                        <li
                          key={a.id}
                          className="flex items-center justify-between text-sm"
                        >
                          <span className="flex items-center gap-1.5 text-zinc-700">
                            <span
                              className={`rounded px-1.5 py-0.5 text-[10px] ${
                                a.type === "addon"
                                  ? "bg-orange-100 text-orange-700"
                                  : "bg-emerald-100 text-emerald-700"
                              }`}
                            >
                              {a.type === "addon" ? "加" : "折"}
                            </span>
                            {a.name_snapshot}
                          </span>
                          <div className="flex items-center gap-2">
                            <span
                              className={`font-mono ${a.type === "addon" ? "text-orange-700" : "text-emerald-700"}`}
                            >
                              {a.type === "addon" ? "+" : "-"}
                              {formatNTD(a.amount)}
                            </span>
                            <button
                              type="button"
                              onClick={() => removeAdj(a)}
                              disabled={adjPending}
                              className="text-zinc-400 hover:text-red-500 disabled:opacity-40"
                              title="刪除"
                            >
                              <Trash2 className="h-3.5 w-3.5" />
                            </button>
                          </div>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-1 flex items-center justify-between text-xs text-zinc-500">
                      <span>加減項合計</span>
                      <span className="font-mono">
                        {localAdjTotal >= 0 ? "+" : ""}
                        {formatNTD(localAdjTotal)}
                      </span>
                    </div>
                    <div className="my-2 border-t border-zinc-200" />
                  </>
                )}
                <div className="flex items-center justify-between">
                  <span className="text-sm font-medium text-zinc-700">
                    應收總額
                  </span>
                  <span className="font-mono text-2xl font-bold text-brand-700">
                    {formatNTD(localTotal)}
                  </span>
                </div>
              </section>

              {/* Adjustment adder */}
              <section className="rounded-md border border-zinc-200 p-3 space-y-3">
                <p className="text-sm font-medium text-zinc-800">加收 / 折扣項目</p>

                {addonItems.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs text-zinc-500">加收</p>
                    <div className="flex flex-wrap gap-1.5">
                      {addonItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          disabled={adjPending}
                          onClick={() => addPresetAdj(item)}
                          className="inline-flex items-center gap-1 rounded-full border border-orange-300 bg-orange-50 px-3 py-1.5 text-sm text-orange-700 hover:bg-orange-100 disabled:opacity-50"
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          {item.name}
                          {item.default_amount > 0 && (
                            <span className="font-mono text-xs">+{formatNTD(item.default_amount)}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {discountItems.length > 0 && (
                  <div>
                    <p className="mb-1.5 text-xs text-zinc-500">折扣</p>
                    <div className="flex flex-wrap gap-1.5">
                      {discountItems.map((item) => (
                        <button
                          key={item.id}
                          type="button"
                          disabled={adjPending}
                          onClick={() => addPresetAdj(item)}
                          className="inline-flex items-center gap-1 rounded-full border border-emerald-300 bg-emerald-50 px-3 py-1.5 text-sm text-emerald-700 hover:bg-emerald-100 disabled:opacity-50"
                        >
                          <PlusCircle className="h-3.5 w-3.5" />
                          {item.name}
                          {item.default_amount > 0 && (
                            <span className="font-mono text-xs">-{formatNTD(item.default_amount)}</span>
                          )}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                {/* Custom entry */}
                <div className="space-y-2">
                  <p className="text-xs text-zinc-500">自訂項目</p>
                  <div className="flex gap-1.5">
                    <button
                      type="button"
                      onClick={() => setCustomType("addon")}
                      className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        customType === "addon"
                          ? "bg-orange-500 text-white"
                          : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      加收
                    </button>
                    <button
                      type="button"
                      onClick={() => setCustomType("discount")}
                      className={`rounded px-2.5 py-1.5 text-xs font-medium transition-colors ${
                        customType === "discount"
                          ? "bg-emerald-500 text-white"
                          : "border border-zinc-300 text-zinc-600 hover:bg-zinc-50"
                      }`}
                    >
                      折扣
                    </button>
                  </div>
                  <div className="flex gap-1.5">
                    <input
                      type="text"
                      value={customName}
                      onChange={(e) => setCustomName(e.target.value)}
                      placeholder="項目名稱"
                      className="min-w-0 flex-1 rounded border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                      maxLength={80}
                    />
                    <input
                      type="number"
                      value={customAmount}
                      onChange={(e) => setCustomAmount(e.target.value)}
                      placeholder="金額"
                      min={0}
                      className="w-24 rounded border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
                    />
                    <button
                      type="button"
                      onClick={addCustomAdj}
                      disabled={adjPending || !customName.trim() || !customAmount}
                      className="rounded bg-zinc-700 px-3 py-1.5 text-sm text-white hover:bg-zinc-900 disabled:opacity-40"
                    >
                      加入
                    </button>
                  </div>
                </div>
              </section>

              <section>
                <p className="mb-2 text-sm font-medium text-zinc-800">
                  快速備註標籤
                </p>
                {presets.length === 0 ? (
                  <p className="text-xs text-zinc-500">
                    老闆娘還沒設定快速備註標籤
                  </p>
                ) : (
                  <div className="space-y-3">
                    {CATEGORY_ORDER.map((cat) => {
                      const group = presets.filter((p) => p.category === cat);
                      if (group.length === 0) return null;
                      return (
                        <div key={cat}>
                          <p className="mb-1 text-xs font-medium text-zinc-500">
                            {CATEGORY_LABEL[cat] ?? cat}
                          </p>
                          <div className="flex flex-wrap gap-1.5">
                            {group.map((p) => {
                              const selected = tags.includes(p.label);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => toggleTag(p.label)}
                                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                    selected
                                      ? "border-brand-600 bg-brand-600 text-white"
                                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                                  }`}
                                >
                                  {p.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })}
                    {(() => {
                      const grouped = new Set(presets.filter((p) => p.category).map((p) => p.label));
                      const ungrouped = presets.filter((p) => !p.category && !grouped.has(p.label));
                      if (ungrouped.length === 0) return null;
                      return (
                        <div>
                          <p className="mb-1 text-xs font-medium text-zinc-500">其他</p>
                          <div className="flex flex-wrap gap-1.5">
                            {ungrouped.map((p) => {
                              const selected = tags.includes(p.label);
                              return (
                                <button
                                  key={p.id}
                                  type="button"
                                  onClick={() => toggleTag(p.label)}
                                  className={`rounded-full border px-3 py-1.5 text-sm transition-colors ${
                                    selected
                                      ? "border-brand-600 bg-brand-600 text-white"
                                      : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                                  }`}
                                >
                                  {p.label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      );
                    })()}
                  </div>
                )}
                {extraTags.length > 0 && (
                  <div className="mt-2">
                    <p className="mb-1 text-xs text-zinc-500">已停用 / 已刪除的舊標籤</p>
                    <div className="flex flex-wrap gap-1.5">
                      {extraTags.map((t) => (
                        <button
                          key={t}
                          type="button"
                          onClick={() => toggleTag(t)}
                          className="rounded-full border border-zinc-400 bg-zinc-100 px-3 py-1.5 text-sm text-zinc-700 line-through"
                          title="點擊移除"
                        >
                          {t}
                        </button>
                      ))}
                    </div>
                  </div>
                )}
              </section>

              <section>
                <label
                  htmlFor="service_notes"
                  className="mb-2 block text-sm font-medium text-zinc-800"
                >
                  特殊備註（文字描述）
                </label>
                <Textarea
                  id="service_notes"
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="例如：客戶習慣中午後不在家、要先聯絡先生、社區管理員要登記、水管狀況不佳…"
                  rows={5}
                  maxLength={2000}
                />
                <p className="mt-1 text-right text-xs text-zinc-400">
                  {notes.length} / 2000
                </p>
              </section>
            </div>

            <div className="sticky bottom-0 flex items-center justify-end gap-2 border-t border-zinc-200 bg-white px-4 py-3">
              <Button
                type="button"
                variant="ghost"
                disabled={pending}
                onClick={() => setDialogOpen(false)}
              >
                取消
              </Button>
              <Button
                type="button"
                disabled={pending}
                onClick={submitDialog}
                className={
                  dialogMode === "complete"
                    ? "bg-green-600 hover:bg-green-700"
                    : ""
                }
              >
                {pending
                  ? "儲存中…"
                  : dialogMode === "complete"
                    ? "確認完成"
                    : "儲存備註"}
              </Button>
            </div>
          </div>
        </div>
      )}
    </>
  );
}
