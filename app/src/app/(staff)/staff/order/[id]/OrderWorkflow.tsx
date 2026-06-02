"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  Banknote,
  ArrowDownToLine,
  CheckCircle2,
  X,
  PlusCircle,
  Trash2,
  Camera,
  Star,
  Check,
} from "lucide-react";
import {
  setPaymentMethodAction,
  confirmMyItemsAction,
  unconfirmMyItemsAction,
  completeOrderAction,
  addOrderAdjustmentAction,
  removeOrderAdjustmentAction,
  addOrderPromotionAction,
  removeOrderPromotionAction,
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
  /** 綁定的服務品項 id；null＝整單級 */
  order_item_id: string | null;
};

type AdjustmentItem = {
  id: string;
  name: string;
  type: "addon" | "discount";
  category: "service" | "parts" | "discount";
  default_amount: number;
};

type PromotionType = {
  id: string;
  code: string;
  label: string;
  points: number;
};

type OrderPromotion = {
  id: string;
  promotion_type_id: string;
  points_snapshot: number;
};

type ItemLite = {
  id: string;
  service_name: string | null;
  quantity: number;
  subtotal: number;
  excluded: boolean;
  unit_price: number;
};

type Props = {
  orderId: string;
  currentPayment: Method;
  isDone: boolean;
  subtotal: number;
  items: ItemLite[];
  initialAdjustments: Adjustment[];
  adjustmentItems: AdjustmentItem[];
  presets: Preset[];
  initialTags: string[];
  initialNotes: string;
  promotionTypes: PromotionType[];
  initialPromotions: OrderPromotion[];
  myUserId: string;
  /** 我負責(未排除)的品項是否都已確認金額（沒有負責品項也為 true） */
  myConfirmed: boolean;
  /** 我在此單有沒有負責的品項 */
  hasMyItems: boolean;
  /** 收款閘門：整單所有未排除品項都已確認 */
  allConfirmed: boolean;
  /** 我是不是此單的現金收款人 */
  iAmCollector: boolean;
  /** 若現金已被別人收走，收款師傅的名字 */
  collectorName: string | null;
};

export function OrderWorkflow({
  orderId,
  currentPayment,
  isDone,
  subtotal,
  items,
  initialAdjustments,
  adjustmentItems,
  presets,
  initialTags,
  initialNotes,
  promotionTypes,
  initialPromotions,
  myUserId,
  myConfirmed,
  hasMyItems,
  allConfirmed,
  iAmCollector,
  collectorName,
}: Props) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [adjPending, startAdjTransition] = useTransition();
  const [promoPending, startPromoTransition] = useTransition();

  // ── State ────────────────────────────────────────────────────────────
  const [localAdj, setLocalAdj] = useState<Adjustment[]>(initialAdjustments);

  // 加減項「套用對象」：'' = 整單；否則為某 order_item id（只可選未排除品項）
  const [adjTarget, setAdjTarget] = useState<string>("");
  const targetItems = items.filter((it) => !it.excluded);
  const itemNameById = new Map(
    items.map((it) => [it.id, it.service_name ?? "品項"] as const),
  );

  const [localPromos, setLocalPromos] =
    useState<OrderPromotion[]>(initialPromotions);
  const activePromoMap = new Map(
    localPromos.map((p) => [p.promotion_type_id, p]),
  );

  const presetLabelSet = new Set(presets.map((p) => p.label));
  const [selectedTagIds, setSelectedTagIds] = useState<Set<string>>(() => {
    const ids = new Set<string>();
    for (const p of presets) if (initialTags.includes(p.label)) ids.add(p.id);
    return ids;
  });
  const [staleTags, setStaleTags] = useState<string[]>(
    initialTags.filter((t) => !presetLabelSet.has(t)),
  );
  const [notes, setNotes] = useState<string>(initialNotes);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [step, setStep] = useState<"checkout" | "complete" | "edit">("checkout");

  // 轉帳收款面板
  const [last5, setLast5] = useState("");
  const [laterTransfer, setLaterTransfer] = useState(false);
  // 二選一才可送出：填滿 5 碼 或 勾「客戶稍後才轉」
  const canSubmitTransfer = laterTransfer || /^\d{5}$/.test(last5);

  // ── Derived ─────────────────────────────────────────────────────────
  const adjSum = (list: Adjustment[]) =>
    list.reduce((s, a) => s + (a.type === "addon" ? a.amount : -a.amount), 0);
  const localAdjTotal = adjSum(localAdj);
  // 拆「品項級」與「訂單級」分別加總，讓小計看得出折扣歸在哪
  const itemAdjTotal = adjSum(localAdj.filter((a) => a.order_item_id));
  const orderAdjTotal = adjSum(localAdj.filter((a) => !a.order_item_id));
  const localTotal = subtotal + localAdjTotal;
  const totalPoints = localPromos.reduce((s, p) => s + p.points_snapshot, 0);

  const tagsForSave = () => [
    ...new Set(presets.filter((p) => selectedTagIds.has(p.id)).map((p) => p.label)),
    ...staleTags,
  ];

  // ── Handlers ────────────────────────────────────────────────────────
  const addPresetAdj = (item: AdjustmentItem) => {
    const target = adjTarget || null;
    startAdjTransition(async () => {
      const res = await addOrderAdjustmentAction(orderId, {
        adjustment_item_id: item.id,
        name_snapshot: item.name,
        type: item.type,
        amount: item.default_amount,
        order_item_id: target,
      });
      if (!res.ok) {
        alert(`新增失敗：${res.error}`);
        return;
      }
      setLocalAdj((prev) => [
        ...prev,
        { id: res.realId!, name_snapshot: item.name, type: item.type, amount: item.default_amount, order_item_id: target },
      ]);
    });
  };

  // 從下拉選 preset + 自填金額加入（服務加收 / 零件加收用；金額預設帶 preset 但可改）
  const addAddonWithAmount = (item: AdjustmentItem, amount: number) => {
    const target = adjTarget || null;
    startAdjTransition(async () => {
      const res = await addOrderAdjustmentAction(orderId, {
        adjustment_item_id: item.id,
        name_snapshot: item.name,
        type: item.type,
        amount,
        order_item_id: target,
      });
      if (!res.ok) {
        alert(`新增失敗：${res.error}`);
        return;
      }
      setLocalAdj((prev) => [
        ...prev,
        { id: res.realId!, name_snapshot: item.name, type: item.type, amount, order_item_id: target },
      ]);
    });
  };

  const removeAdj = (adj: Adjustment) => {
    setLocalAdj((prev) => prev.filter((a) => a.id !== adj.id));
    startAdjTransition(async () => {
      const res = await removeOrderAdjustmentAction(adj.id, orderId);
      if (!res.ok) {
        alert(`刪除失敗：${res.error}`);
        setLocalAdj((prev) => [...prev, adj]);
      }
    });
  };

  const togglePromo = (typeId: string, points: number) => {
    const existing = activePromoMap.get(typeId);
    if (existing) {
      setLocalPromos((prev) => prev.filter((p) => p.id !== existing.id));
      startPromoTransition(async () => {
        const res = await removeOrderPromotionAction(existing.id);
        if (!res.ok) {
          alert(res.error);
          setLocalPromos((prev) => [...prev, existing]);
        }
      });
    } else {
      const tempId = `__tmp__${typeId}`;
      const optimistic = { id: tempId, promotion_type_id: typeId, points_snapshot: points };
      setLocalPromos((prev) => [...prev, optimistic]);
      startPromoTransition(async () => {
        const res = await addOrderPromotionAction(orderId, typeId, myUserId);
        if (!res.ok) {
          alert(res.error);
          setLocalPromos((prev) => prev.filter((p) => p.id !== tempId));
        }
        // 真實 ID 等下次 revalidate 就會帶回來，optimistic 暫保留
      });
    }
  };

  const choosePayment = (method: Method, transferLast5?: string) => {
    startTransition(async () => {
      const res = await setPaymentMethodAction(orderId, method, transferLast5);
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setStep("complete");
    });
  };

  const revertToUnpaid = () => {
    if (!confirm("確認改回「未收款」？")) return;
    startTransition(async () => {
      const res = await setPaymentMethodAction(orderId, "unpaid");
      if (!res.ok) alert(res.error);
    });
  };

  const finalize = () => {
    startTransition(async () => {
      const res = await completeOrderAction(orderId, {
        service_tags: tagsForSave(),
        service_notes: notes,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setDialogOpen(false);
      // 完成後直接跳回今日案件首頁（師傅在手機上不必再手動返回）
      router.push("/staff");
    });
  };

  const openCheckout = () => {
    setStep("checkout");
    setLast5("");
    setLaterTransfer(false);
    setDialogOpen(true);
  };

  // 開「完成案件」對話框（與收款解耦：誰最後做完都可按）
  const openComplete = () => {
    setStep("complete");
    setSelectedTagIds(() => {
      const ids = new Set<string>();
      for (const p of presets) if (initialTags.includes(p.label)) ids.add(p.id);
      return ids;
    });
    setStaleTags(initialTags.filter((t) => !presetLabelSet.has(t)));
    setNotes(initialNotes);
    setDialogOpen(true);
  };

  // 師傅確認「自己負責品項」的金額（多師傅同單收款閘門）
  const confirmMine = () => {
    startTransition(async () => {
      const res = await confirmMyItemsAction(orderId);
      if (!res.ok) alert(res.error);
    });
  };

  // 按錯了要重新調整：解除確認
  const unconfirmMine = () => {
    startTransition(async () => {
      const res = await unconfirmMyItemsAction(orderId);
      if (!res.ok) alert(res.error);
    });
  };

  const openEditNotes = () => {
    setStep("edit");
    setSelectedTagIds(() => {
      const ids = new Set<string>();
      for (const p of presets) if (initialTags.includes(p.label)) ids.add(p.id);
      return ids;
    });
    setStaleTags(initialTags.filter((t) => !presetLabelSet.has(t)));
    setNotes(initialNotes);
    setDialogOpen(true);
  };

  const saveNotesOnly = () => {
    // 用 completeOrderAction 也可以但會把 status 設成 done，這裡 isDone 已 true 等同 no-op，沿用同 action
    startTransition(async () => {
      const res = await completeOrderAction(orderId, {
        service_tags: tagsForSave(),
        service_notes: notes,
      });
      if (!res.ok) {
        alert(res.error);
        return;
      }
      setDialogOpen(false);
    });
  };

  const serviceAddons = adjustmentItems.filter((a) => a.category === "service");
  const partsAddons = adjustmentItems.filter((a) => a.category === "parts");
  const discountItems = adjustmentItems.filter((a) => a.category === "discount");

  // ─────────────────────────────────────────────────────────────────────
  return (
    <>
      {/* 加收 / 折扣編輯（!isDone 時顯示） */}
      {!isDone && (
        <Card>
          <CardHeader>
            <CardTitle className="flex items-center gap-2">
              加收 / 折扣
              <span className="text-xs font-normal text-zinc-500">
                結帳前先確認所有加項
              </span>
            </CardTitle>
          </CardHeader>
          <CardBody className="space-y-3">
            {localAdj.length > 0 ? (
              <ul className="space-y-1">
                {localAdj.map((a) => (
                  <li
                    key={a.id}
                    className="flex items-center justify-between rounded bg-zinc-50 px-3 py-1.5 text-sm"
                  >
                    <span className="flex min-w-0 flex-wrap items-center gap-1.5 text-zinc-700">
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
                      <span
                        className={`rounded px-1.5 py-0.5 text-[10px] ${
                          a.order_item_id
                            ? "bg-sky-100 text-sky-700"
                            : "bg-zinc-200 text-zinc-600"
                        }`}
                      >
                        {a.order_item_id
                          ? itemNameById.get(a.order_item_id) ?? "品項"
                          : "整單"}
                      </span>
                    </span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`font-mono ${
                          a.type === "addon" ? "text-orange-700" : "text-emerald-700"
                        }`}
                      >
                        {a.type === "addon" ? "+" : "-"}
                        {formatNTD(a.amount)}
                      </span>
                      <button
                        type="button"
                        onClick={() => removeAdj(a)}
                        disabled={adjPending}
                        className="text-zinc-400 hover:text-red-500 disabled:opacity-40"
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  </li>
                ))}
              </ul>
            ) : (
              <p className="text-xs text-zinc-500">尚無加減項</p>
            )}

            {/* 套用對象：多個品項時才需要選（單一品項時加減項本來就只能算它/整單） */}
            {targetItems.length > 1 && (
              <div className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2">
                <label className="mb-1 block text-xs font-medium text-sky-800">
                  以下要加的加減項，套用到：
                </label>
                <select
                  value={adjTarget}
                  onChange={(e) => setAdjTarget(e.target.value)}
                  className="w-full rounded border border-sky-300 bg-white px-2.5 py-1.5 text-sm focus:border-sky-500 focus:outline-none"
                >
                  <option value="">整單（每一項都算）</option>
                  {targetItems.map((it) => (
                    <option key={it.id} value={it.id}>
                      {it.service_name ?? "品項"}（牌價 {formatNTD(it.subtotal)}）
                    </option>
                  ))}
                </select>
                <p className="mt-1 text-[11px] text-sky-700">
                  例：定期客戶每台洗衣機各折 100，就先選某台洗衣機再按折扣；冷氣不折就別選它。
                </p>
              </div>
            )}

            {/* 服務加收：下拉選 + 金額（項目多，用下拉） */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-orange-700">服務加收</p>
              <AddonPicker
                items={serviceAddons}
                pending={adjPending}
                onAdd={addAddonWithAmount}
              />
            </div>

            {/* 零件加收：下拉選 + 金額（零件價浮動，金額可改；清單沒有選「其他零件」） */}
            <div>
              <p className="mb-1.5 text-xs font-medium text-amber-700">零件加收</p>
              <AddonPicker
                items={partsAddons}
                pending={adjPending}
                onAdd={addAddonWithAmount}
              />
            </div>

            {/* 優惠折扣：項目少，維持快速 chip */}
            {discountItems.length > 0 && (
              <div>
                <p className="mb-1.5 text-xs font-medium text-emerald-700">優惠折扣</p>
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
          </CardBody>
        </Card>
      )}

      {/* 應收總額（live） */}
      <Card>
        <CardBody className="space-y-1">
          <div className="flex items-center justify-between text-sm text-zinc-600">
            <span>項目小計（牌價）</span>
            <span className="font-mono">{formatNTD(subtotal)}</span>
          </div>
          {itemAdjTotal !== 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-600">品項加減（綁定品項）</span>
              <span
                className={`font-mono ${
                  itemAdjTotal > 0 ? "text-orange-700" : "text-emerald-700"
                }`}
              >
                {itemAdjTotal > 0 ? "+" : ""}
                {formatNTD(itemAdjTotal)}
              </span>
            </div>
          )}
          {orderAdjTotal !== 0 && (
            <div className="flex items-center justify-between text-sm">
              <span className="text-zinc-600">訂單加減（整單）</span>
              <span
                className={`font-mono ${
                  orderAdjTotal > 0 ? "text-orange-700" : "text-emerald-700"
                }`}
              >
                {orderAdjTotal > 0 ? "+" : ""}
                {formatNTD(orderAdjTotal)}
              </span>
            </div>
          )}
          <div className="flex items-center justify-between border-t border-zinc-200 pt-2">
            <span className="text-sm font-medium text-zinc-800">應收總額</span>
            <span className="font-mono text-3xl font-bold text-brand-700">
              {formatNTD(localTotal)}
            </span>
          </div>
        </CardBody>
      </Card>

      {/* 主操作 */}
      <Card>
        <CardBody className="space-y-3">
          {/* ── 收款區 ── */}
          {currentPayment === "unpaid" ? (
            hasMyItems && !myConfirmed ? (
              <>
                <Button
                  size="lg"
                  className="w-full"
                  disabled={pending}
                  onClick={confirmMine}
                >
                  <Check className="h-5 w-5" /> 確認我的金額
                </Button>
                <p className="text-center text-xs text-zinc-500">
                  請先核對現場機器與品項是否一致（老闆娘建單內容僅供參考），調好金額再確認；等所有師傅都確認後，由最後一位收全額
                </p>
              </>
            ) : !allConfirmed ? (
              <div className="rounded-lg border border-amber-200 bg-amber-50 px-3 py-3 text-center text-sm text-amber-800">
                ✓ 你的金額已確認
                <div className="mt-0.5 text-xs text-amber-700">
                  等待其他師傅確認中…由最後完成的師傅向客戶收全額
                </div>
                {hasMyItems && (
                  <button
                    type="button"
                    onClick={unconfirmMine}
                    disabled={pending}
                    className="mt-2 text-xs text-amber-700 underline disabled:opacity-40"
                  >
                    ↩ 按錯了？重新調整我的金額
                  </button>
                )}
              </div>
            ) : (
              <>
                <Button
                  size="lg"
                  className="w-full"
                  disabled={pending}
                  onClick={openCheckout}
                >
                  <Banknote className="h-5 w-5" /> 結帳收款
                </Button>
                {hasMyItems && (
                  <button
                    type="button"
                    onClick={unconfirmMine}
                    disabled={pending}
                    className="block w-full text-center text-xs text-zinc-400 underline disabled:opacity-40"
                  >
                    ↩ 重新調整我的金額（取消確認）
                  </button>
                )}
              </>
            )
          ) : currentPayment === "cash" && !iAmCollector ? (
            <div className="rounded-lg border border-zinc-300 bg-zinc-50 px-3 py-3 text-center">
              <p className="text-sm font-medium text-zinc-700">
                🔒 此單現金 {formatNTD(localTotal)}
              </p>
              <p className="text-sm text-zinc-600">
                已由「{collectorName ?? "其他師傅"}」收取
              </p>
              <p className="mt-1 text-xs text-zinc-400">
                收款相關操作僅收款人本人或老闆娘可更動
              </p>
            </div>
          ) : (
            <>
              <p
                className={`rounded px-3 py-2 text-center text-sm font-medium ${
                  currentPayment === "cash"
                    ? "bg-green-50 text-green-700"
                    : "bg-blue-50 text-blue-700"
                }`}
              >
                {currentPayment === "cash"
                  ? `✓ 已收現金 ${formatNTD(localTotal)}`
                  : `✓ 客戶已付款 ${formatNTD(localTotal)}`}
              </p>
              <Button
                size="sm"
                variant="outline"
                className="w-full"
                disabled={pending}
                onClick={revertToUnpaid}
              >
                改回「未收款」（修正用）
              </Button>
            </>
          )}

          {/* ── 完工區：必須先完成收款(現金/轉帳)才能完成案件 ── */}
          <div className="border-t border-zinc-100 pt-3">
            {!isDone ? (
              currentPayment === "unpaid" ? (
                <>
                  <Button
                    size="lg"
                    className="w-full"
                    disabled
                  >
                    <CheckCircle2 className="h-5 w-5" /> 完成此案件
                  </Button>
                  <p className="mt-1.5 text-center text-xs text-amber-600">
                    請先完成上方收款（現金或轉帳）才能完成案件
                  </p>
                </>
              ) : (
                <Button
                  size="lg"
                  className="w-full"
                  disabled={pending}
                  onClick={openComplete}
                >
                  <CheckCircle2 className="h-5 w-5" /> 完成此案件
                </Button>
              )
            ) : (
              <>
                <p className="py-1 text-center text-sm font-medium text-green-700">
                  ✓ 此案件已完成
                </p>
                <Button
                  size="md"
                  variant="outline"
                  className="w-full"
                  disabled={pending}
                  onClick={openEditNotes}
                >
                  補 / 修改備註
                </Button>
              </>
            )}
          </div>
        </CardBody>
      </Card>

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
                {step === "checkout"
                  ? "結帳收款 — 確認金額"
                  : step === "complete"
                    ? "完成此案件"
                    : "編輯備註"}
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
              {/* Step 1: 結帳確認 */}
              {step === "checkout" && (
                <>
                  <section className="rounded-md bg-zinc-50 p-3 space-y-2">
                    {/* 服務項目明細 */}
                    {items.length > 0 && (
                      <div>
                        <p className="mb-1 text-xs font-medium text-zinc-500">
                          服務項目
                        </p>
                        <ul className="space-y-0.5">
                          {items.map((it) => (
                            <li
                              key={it.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-zinc-700 min-w-0 truncate">
                                {it.service_name ?? "—"}
                                {it.quantity > 1 && (
                                  <span className="ml-1 text-zinc-500">
                                    × {it.quantity}
                                  </span>
                                )}
                              </span>
                              <span className="font-mono text-zinc-700 shrink-0 ml-2">
                                {formatNTD(it.subtotal)}
                              </span>
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="flex items-center justify-between text-sm text-zinc-600 border-t border-zinc-200 pt-1.5">
                      <span>項目小計</span>
                      <span className="font-mono">{formatNTD(subtotal)}</span>
                    </div>
                    {/* 加減項 */}
                    {localAdj.length > 0 && (
                      <>
                        <ul className="space-y-0.5">
                          {localAdj.map((a) => (
                            <li
                              key={a.id}
                              className="flex items-center justify-between text-sm"
                            >
                              <span className="text-zinc-700">
                                <span
                                  className={`mr-1.5 rounded px-1 py-0.5 text-[10px] ${
                                    a.type === "addon"
                                      ? "bg-orange-100 text-orange-700"
                                      : "bg-emerald-100 text-emerald-700"
                                  }`}
                                >
                                  {a.type === "addon" ? "加" : "折"}
                                </span>
                                {a.name_snapshot}
                                {a.order_item_id && (
                                  <span className="ml-1.5 rounded bg-sky-100 px-1 py-0.5 text-[10px] text-sky-700">
                                    {itemNameById.get(a.order_item_id) ?? "品項"}
                                  </span>
                                )}
                              </span>
                              <span
                                className={`font-mono ${
                                  a.type === "addon"
                                    ? "text-orange-700"
                                    : "text-emerald-700"
                                }`}
                              >
                                {a.type === "addon" ? "+" : "-"}
                                {formatNTD(a.amount)}
                              </span>
                            </li>
                          ))}
                        </ul>
                        <div className="flex items-center justify-between text-xs text-zinc-500">
                          <span>加減項合計</span>
                          <span className="font-mono">
                            {localAdjTotal >= 0 ? "+" : ""}
                            {formatNTD(localAdjTotal)}
                          </span>
                        </div>
                      </>
                    )}
                    <div className="border-t border-zinc-200 pt-2 flex items-center justify-between">
                      <span className="text-sm font-medium text-zinc-700">
                        實收總額
                      </span>
                      <span className="font-mono text-2xl font-bold text-brand-700">
                        {formatNTD(localTotal)}
                      </span>
                    </div>
                  </section>

                  <p className="text-xs text-amber-700 bg-amber-50 rounded p-2 text-center">
                    確認金額正確後，選擇客戶的收款方式：
                  </p>

                  {/* 收現金：一鍵 */}
                  <Button
                    type="button"
                    size="lg"
                    className="w-full"
                    disabled={pending}
                    onClick={() => choosePayment("cash")}
                  >
                    <Banknote className="h-5 w-5" /> 收到現金
                  </Button>

                  <div className="flex items-center gap-2 text-xs text-zinc-400">
                    <span className="h-px flex-1 bg-zinc-200" />或<span className="h-px flex-1 bg-zinc-200" />
                  </div>

                  {/* 客戶轉帳：直接攤開，填後五碼或勾稍後轉，按一顆確認鍵 */}
                  <div className="space-y-3 rounded-lg border border-blue-200 bg-blue-50/50 p-3">
                    <p className="flex items-center gap-1.5 text-sm font-medium text-blue-800">
                      <ArrowDownToLine className="h-4 w-4" /> 客戶轉帳
                    </p>
                    <div>
                      <label className="mb-1 block text-xs font-medium text-zinc-600">
                        轉帳帳號後五碼（請客人報帳號末 5 碼，方便老闆娘對帳）
                      </label>
                      <input
                        type="text"
                        inputMode="numeric"
                        value={last5}
                        disabled={laterTransfer}
                        onChange={(e) =>
                          setLast5(e.target.value.replace(/\D/g, "").slice(0, 5))
                        }
                        placeholder="例如 12345"
                        className="w-full rounded border border-zinc-300 px-3 py-2 text-center font-mono text-lg tracking-widest focus:border-brand-500 focus:outline-none disabled:bg-zinc-100 disabled:text-zinc-400"
                      />
                    </div>
                    <label className="flex items-center gap-2 text-sm text-zinc-700">
                      <input
                        type="checkbox"
                        checked={laterTransfer}
                        onChange={(e) => {
                          setLaterTransfer(e.target.checked);
                          if (e.target.checked) setLast5("");
                        }}
                        className="h-4 w-4"
                      />
                      客戶稍後才轉（先記轉帳，後五碼由老闆娘對帳補上）
                    </label>
                    <Button
                      type="button"
                      size="lg"
                      className="w-full bg-blue-600 hover:bg-blue-700"
                      disabled={pending || !canSubmitTransfer}
                      onClick={() =>
                        choosePayment("transfer", laterTransfer ? undefined : last5)
                      }
                    >
                      <ArrowDownToLine className="h-5 w-5" />
                      {pending
                        ? "處理中…"
                        : laterTransfer
                          ? "確認（客戶稍後轉帳）"
                          : "確認轉帳收款"}
                    </Button>
                    {!canSubmitTransfer && (
                      <p className="text-center text-xs text-zinc-400">
                        請填 5 位後五碼，或勾「客戶稍後才轉」
                      </p>
                    )}
                  </div>
                </>
              )}

              {/* Step 2: 完成案件 */}
              {step === "complete" && (
                <>
                  <div className="rounded-lg border border-amber-300 bg-amber-50 p-3">
                    <p className="flex items-center gap-2 text-sm font-medium text-amber-900">
                      <Camera className="h-4 w-4" /> 📸 記得拍照
                    </p>
                    <p className="mt-1 text-xs text-amber-800">
                      清洗完成、客戶滿意的照片可以幫店家累積口碑，也方便日後客戶詢問時調出參考。
                    </p>
                  </div>

                  <section>
                    <div className="mb-2 flex items-center justify-between">
                      <p className="flex items-center gap-1.5 text-sm font-medium text-zinc-800">
                        <Star className="h-4 w-4 text-amber-500" />
                        促銷積分（自行確認是否取得）
                      </p>
                      <span className="font-mono text-sm font-bold text-amber-700">
                        +{totalPoints} 分
                      </span>
                    </div>
                    {promotionTypes.length === 0 ? (
                      <p className="text-xs text-zinc-500">
                        老闆娘還沒設定促銷積分類型
                      </p>
                    ) : (
                      <div className="grid grid-cols-1 gap-1.5 sm:grid-cols-2">
                        {promotionTypes.map((t) => {
                          const active = activePromoMap.has(t.id);
                          return (
                            <button
                              key={t.id}
                              type="button"
                              onClick={() => togglePromo(t.id, t.points)}
                              disabled={promoPending}
                              className={`flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-left text-sm transition-colors ${
                                active
                                  ? "border-amber-500 bg-amber-100 text-amber-900"
                                  : "border-zinc-300 bg-white text-zinc-700 hover:bg-zinc-50"
                              }`}
                            >
                              <span className="flex items-center gap-1.5">
                                {active && (
                                  <Check className="h-4 w-4 text-amber-700" />
                                )}
                                <span className={active ? "font-medium" : ""}>
                                  {t.label}
                                </span>
                              </span>
                              <span
                                className={`font-mono text-xs font-bold ${
                                  active ? "text-amber-700" : "text-zinc-500"
                                }`}
                              >
                                +{t.points}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    )}
                  </section>

                  <CompletionTagsAndNotesEditor
                    presets={presets}
                    selectedTagIds={selectedTagIds}
                    setSelectedTagIds={setSelectedTagIds}
                    staleTags={staleTags}
                    setStaleTags={setStaleTags}
                    notes={notes}
                    setNotes={setNotes}
                  />
                </>
              )}

              {/* Edit mode: 完成後補修備註 */}
              {step === "edit" && (
                <CompletionTagsAndNotesEditor
                  presets={presets}
                  selectedTagIds={selectedTagIds}
                  setSelectedTagIds={setSelectedTagIds}
                  staleTags={staleTags}
                  setStaleTags={setStaleTags}
                  notes={notes}
                  setNotes={setNotes}
                />
              )}
            </div>

            {/* Bottom action bar */}
            {step === "checkout" ? (
              <div className="sticky bottom-0 flex items-center justify-end border-t border-zinc-200 bg-white px-4 py-3">
                <Button
                  type="button"
                  variant="ghost"
                  disabled={pending}
                  onClick={() => setDialogOpen(false)}
                >
                  取消
                </Button>
              </div>
            ) : (
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
                  onClick={step === "edit" ? saveNotesOnly : finalize}
                  className={
                    step === "complete"
                      ? "bg-green-600 hover:bg-green-700"
                      : ""
                  }
                >
                  {pending ? (
                    "處理中…"
                  ) : step === "complete" ? (
                    <>
                      <CheckCircle2 className="h-4 w-4" /> 完成此案件
                    </>
                  ) : (
                    "儲存備註"
                  )}
                </Button>
              </div>
            )}
          </div>
        </div>
      )}
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
function CompletionTagsAndNotesEditor({
  presets,
  selectedTagIds,
  setSelectedTagIds,
  staleTags,
  setStaleTags,
  notes,
  setNotes,
}: {
  presets: Preset[];
  selectedTagIds: Set<string>;
  setSelectedTagIds: (s: Set<string>) => void;
  staleTags: string[];
  setStaleTags: (fn: (prev: string[]) => string[]) => void;
  notes: string;
  setNotes: (s: string) => void;
}) {
  const togglePreset = (id: string) => {
    const next = new Set(selectedTagIds);
    if (next.has(id)) next.delete(id);
    else next.add(id);
    setSelectedTagIds(next);
  };

  return (
    <>
      <section>
        <p className="mb-2 text-sm font-medium text-zinc-800">快速備註標籤</p>
        {presets.length === 0 ? (
          <p className="text-xs text-zinc-500">老闆娘還沒設定快速備註標籤</p>
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
                      const selected = selectedTagIds.has(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePreset(p.id)}
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
                      const selected = selectedTagIds.has(p.id);
                      return (
                        <button
                          key={p.id}
                          type="button"
                          onClick={() => togglePreset(p.id)}
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
        {staleTags.length > 0 && (
          <div className="mt-2">
            <p className="mb-1 text-xs text-zinc-500">已停用 / 已刪除的舊標籤</p>
            <div className="flex flex-wrap gap-1.5">
              {staleTags.map((t) => (
                <button
                  key={t}
                  type="button"
                  onClick={() => setStaleTags((prev) => prev.filter((s) => s !== t))}
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
    </>
  );
}

// ─────────────────────────────────────────────────────────────────────
// 服務加收 / 零件加收：下拉選 preset + 自填金額（金額預設帶 preset，可改）
function AddonPicker({
  items,
  pending,
  onAdd,
}: {
  items: AdjustmentItem[];
  pending: boolean;
  onAdd: (item: AdjustmentItem, amount: number) => void;
}) {
  const [selectedId, setSelectedId] = useState("");
  const [amount, setAmount] = useState("");

  if (items.length === 0) {
    return <p className="text-xs text-zinc-400">老闆娘尚未設定此類項目</p>;
  }

  const onSelect = (val: string) => {
    setSelectedId(val);
    const it = items.find((i) => i.id === val);
    setAmount(it ? String(it.default_amount) : "");
  };

  const submit = () => {
    const it = items.find((i) => i.id === selectedId);
    if (!it) {
      alert("請先選擇項目");
      return;
    }
    const amt = parseInt(amount, 10);
    if (isNaN(amt) || amt < 0) {
      alert("請填正確金額");
      return;
    }
    onAdd(it, amt);
    setSelectedId("");
    setAmount("");
  };

  return (
    <div className="flex gap-1.5">
      <select
        value={selectedId}
        onChange={(e) => onSelect(e.target.value)}
        className="min-w-0 flex-1 rounded border border-zinc-300 bg-white px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
      >
        <option value="">— 選擇項目 —</option>
        {items.map((i) => (
          <option key={i.id} value={i.id}>
            {i.name}
            {i.default_amount > 0 ? `（預設 ${formatNTD(i.default_amount)}）` : ""}
          </option>
        ))}
      </select>
      <input
        type="number"
        value={amount}
        onChange={(e) => setAmount(e.target.value)}
        placeholder="金額"
        min={0}
        className="w-24 rounded border border-zinc-300 px-2.5 py-1.5 text-sm focus:border-brand-500 focus:outline-none"
      />
      <button
        type="button"
        onClick={submit}
        disabled={pending || !selectedId}
        className="shrink-0 rounded bg-orange-600 px-3 py-1.5 text-sm font-medium text-white hover:bg-orange-700 disabled:opacity-40"
      >
        加入
      </button>
    </div>
  );
}
