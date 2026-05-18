"use client";

import { useTransition } from "react";
import { Banknote, ArrowDownToLine, CheckCircle2 } from "lucide-react";
import {
  setPaymentMethodAction,
  completeOrderAction,
} from "@/app/(admin)/orders/actions";
import { Button } from "@/components/ui/Button";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import type { OrderInput } from "@/lib/validators/order";

type Method = OrderInput["payment_method"];

export function StaffActions({
  orderId,
  currentPayment,
  isDone,
}: {
  orderId: string;
  currentPayment: Method;
  isDone: boolean;
}) {
  const [pending, startTransition] = useTransition();

  const setMethod = (method: Method, label: string) => {
    if (!confirm(`確認改為「${label}」？`)) return;
    startTransition(async () => {
      const res = await setPaymentMethodAction(orderId, method);
      if (!res.ok) alert(res.error);
    });
  };

  const onComplete = () => {
    if (!confirm("確認標記此訂單為完成？")) return;
    startTransition(async () => {
      const res = await completeOrderAction(orderId);
      if (!res.ok) alert(res.error);
    });
  };

  return (
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
              onClick={onComplete}
            >
              <CheckCircle2 className="h-5 w-5" /> 完成此案件
            </Button>
          )}
          {isDone && (
            <p className="text-center py-3 text-sm font-medium text-green-700">
              ✓ 已完成
            </p>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
