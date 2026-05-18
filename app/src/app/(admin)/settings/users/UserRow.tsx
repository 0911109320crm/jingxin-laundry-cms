"use client";

import { useState, useTransition } from "react";
import { Pencil, Trash2, Check, X, KeyRound } from "lucide-react";
import {
  updateUser,
  deleteUser,
  resetPassword,
} from "@/app/(admin)/settings/users/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Select } from "@/components/ui/Select";

export type UserItem = {
  id: string;
  email: string | null;
  name: string;
  phone: string | null;
  role: "owner" | "manager" | "technician";
  active: boolean;
};

const ROLE_LABEL: Record<UserItem["role"], string> = {
  owner: "老闆",
  manager: "管理員",
  technician: "師傅",
};

const ROLE_COLOR: Record<UserItem["role"], string> = {
  owner: "bg-rose-50 text-rose-700",
  manager: "bg-amber-50 text-amber-700",
  technician: "bg-sky-50 text-sky-700",
};

export function UserRow({ user, isSelf }: { user: UserItem; isSelf: boolean }) {
  const [editing, setEditing] = useState(false);
  const [pending, startTransition] = useTransition();

  const onSave = (fd: FormData) => {
    startTransition(async () => {
      const res = await updateUser(user.id, fd);
      if (!res.ok) alert(res.error);
      else setEditing(false);
    });
  };

  const onResetPassword = () => {
    const pwd = prompt(`重設「${user.name}」的密碼（至少 6 字）：`, "admin1234");
    if (!pwd) return;
    const fd = new FormData();
    fd.set("password", pwd);
    startTransition(async () => {
      const res = await resetPassword(user.id, fd);
      if (!res.ok) alert(res.error);
      else alert("密碼已更新");
    });
  };

  const onDelete = () => {
    if (!confirm(`刪除「${user.name}」？此操作無法復原。`)) return;
    startTransition(async () => {
      const res = await deleteUser(user.id);
      if (!res.ok) alert(res.error);
    });
  };

  if (editing) {
    return (
      <form
        action={onSave}
        className="grid grid-cols-[1fr_1fr_1fr_120px_80px_auto] items-center gap-2 px-5 py-3"
      >
        <Input name="name" defaultValue={user.name} required />
        <div className="text-xs text-zinc-500 truncate">{user.email}</div>
        <Input name="phone" defaultValue={user.phone ?? ""} placeholder="電話" />
        <Select name="role" defaultValue={user.role} disabled={isSelf}>
          <option value="technician">師傅</option>
          <option value="manager">管理員</option>
          <option value="owner">老闆</option>
        </Select>
        <label className="flex items-center gap-1 text-sm text-zinc-600">
          <input
            type="checkbox"
            name="active"
            defaultChecked={user.active}
            className="h-4 w-4"
            disabled={isSelf}
          />
          啟用
        </label>
        <div className="flex gap-1">
          <Button type="submit" size="sm" disabled={pending}>
            <Check className="h-4 w-4" />
          </Button>
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={() => setEditing(false)}
          >
            <X className="h-4 w-4" />
          </Button>
        </div>
      </form>
    );
  }

  return (
    <div className="grid grid-cols-[1fr_1fr_1fr_120px_80px_auto] items-center gap-2 px-5 py-3 text-sm">
      <div className="font-medium text-zinc-900">
        {user.name}
        {isSelf && (
          <span className="ml-1 text-xs text-zinc-400">（你）</span>
        )}
      </div>
      <div className="text-xs text-zinc-500 truncate">{user.email ?? "—"}</div>
      <div className="text-zinc-600">{user.phone ?? "—"}</div>
      <div>
        <span
          className={`rounded px-2 py-0.5 text-xs ${ROLE_COLOR[user.role]}`}
        >
          {ROLE_LABEL[user.role]}
        </span>
      </div>
      <div>
        {user.active ? (
          <span className="rounded bg-green-50 px-2 py-0.5 text-xs text-green-700">
            啟用
          </span>
        ) : (
          <span className="rounded bg-zinc-100 px-2 py-0.5 text-xs text-zinc-500">
            停用
          </span>
        )}
      </div>
      <div className="flex gap-1">
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={() => setEditing(true)}
          title="編輯"
        >
          <Pencil className="h-4 w-4" />
        </Button>
        <Button
          type="button"
          size="sm"
          variant="ghost"
          onClick={onResetPassword}
          disabled={pending}
          title="重設密碼"
        >
          <KeyRound className="h-4 w-4" />
        </Button>
        {!isSelf && (
          <Button
            type="button"
            size="sm"
            variant="ghost"
            onClick={onDelete}
            disabled={pending}
            title="刪除"
          >
            <Trash2 className="h-4 w-4" />
          </Button>
        )}
      </div>
    </div>
  );
}
