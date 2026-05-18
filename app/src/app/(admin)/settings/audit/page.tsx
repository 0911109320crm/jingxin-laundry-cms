import { Activity } from "lucide-react";
import { requireRole } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { formatDateTime } from "@/lib/utils";

type Row = {
  id: string;
  user_id: string | null;
  action: string;
  target_type: string | null;
  target_id: string | null;
  payload: Record<string, unknown> | null;
  created_at: string;
};

const ACTION_LABEL: Record<string, string> = {
  "order.cancel": "取消訂單",
  "order.delete": "刪除訂單",
  "customer.delete": "刪除客戶",
  "settlement.bulk_settle": "批次標記已回繳",
  "user.create": "新增帳號",
  "user.update": "修改帳號",
  "user.delete": "刪除帳號",
  "user.reset_password": "重設密碼",
};

const ACTION_COLOR: Record<string, string> = {
  "order.cancel": "bg-rose-50 text-rose-700",
  "order.delete": "bg-red-100 text-red-800",
  "customer.delete": "bg-red-100 text-red-800",
  "settlement.bulk_settle": "bg-amber-50 text-amber-700",
  "user.create": "bg-green-50 text-green-700",
  "user.update": "bg-blue-50 text-blue-700",
  "user.delete": "bg-red-100 text-red-800",
  "user.reset_password": "bg-purple-50 text-purple-700",
};

export default async function AuditPage() {
  await requireRole(["owner"]);
  const admin = createAdminClient();

  const { data: logsRaw } = await admin
    .from("audit_logs")
    .select("id, user_id, action, target_type, target_id, payload, created_at")
    .order("created_at", { ascending: false })
    .limit(300);

  const logs = (logsRaw as Row[] | null) ?? [];

  const userIds = Array.from(
    new Set(logs.map((l) => l.user_id).filter(Boolean) as string[]),
  );
  let nameMap = new Map<string, string>();
  if (userIds.length > 0) {
    const { data: profiles } = await admin
      .from("user_profiles")
      .select("id, name")
      .in("id", userIds);
    nameMap = new Map(
      ((profiles ?? []) as { id: string; name: string }[]).map((p) => [
        p.id,
        p.name,
      ]),
    );
  }

  return (
    <div className="p-8 space-y-5">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">操作稽核</h1>
        <p className="text-sm text-zinc-500">
          僅老闆可進入。紀錄系統內所有寫入 / 刪除 / 取消等敏感操作（顯示最近 300 筆）。
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Activity className="h-4 w-4 text-zinc-500" />
            操作紀錄（{logs.length}）
          </CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          {logs.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">尚無紀錄</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {logs.map((l) => {
                const actor = l.user_id ? nameMap.get(l.user_id) ?? l.user_id.slice(0, 8) : "—";
                const label = ACTION_LABEL[l.action] ?? l.action;
                const color =
                  ACTION_COLOR[l.action] ?? "bg-zinc-100 text-zinc-700";
                const payloadStr = l.payload
                  ? Object.entries(l.payload)
                      .filter(([, v]) => v !== null && v !== "")
                      .map(([k, v]) => `${k}: ${typeof v === "object" ? JSON.stringify(v) : v}`)
                      .join(" · ")
                  : "";
                return (
                  <li
                    key={l.id}
                    className="grid grid-cols-1 gap-2 px-5 py-3 text-sm md:grid-cols-[180px_120px_120px_1fr]"
                  >
                    <span className="text-xs text-zinc-500">
                      {formatDateTime(l.created_at)}
                    </span>
                    <span className="font-medium text-zinc-900">{actor}</span>
                    <span
                      className={`inline-block w-fit rounded px-2 py-0.5 text-xs font-medium ${color}`}
                    >
                      {label}
                    </span>
                    <span className="text-xs text-zinc-600 break-all">
                      {l.target_type && l.target_id
                        ? `${l.target_type}#${l.target_id.slice(0, 8)} `
                        : ""}
                      {payloadStr}
                    </span>
                  </li>
                );
              })}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
