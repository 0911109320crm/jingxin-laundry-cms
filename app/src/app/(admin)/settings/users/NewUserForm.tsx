"use client";

import { useRef, useTransition } from "react";
import { Plus } from "lucide-react";
import { createUser } from "@/app/(admin)/settings/users/actions";
import { Button } from "@/components/ui/Button";
import { Input } from "@/components/ui/Input";
import { Label } from "@/components/ui/Label";
import { Select } from "@/components/ui/Select";

export function NewUserForm() {
  const [pending, startTransition] = useTransition();
  const formRef = useRef<HTMLFormElement>(null);

  const onSubmit = (fd: FormData) => {
    startTransition(async () => {
      const res = await createUser(fd);
      if (!res.ok) alert(res.error);
      else formRef.current?.reset();
    });
  };

  return (
    <form
      ref={formRef}
      action={onSubmit}
      className="grid grid-cols-1 gap-3 md:grid-cols-5"
    >
      <div className="space-y-1.5">
        <Label htmlFor="name">姓名</Label>
        <Input id="name" name="name" placeholder="例如 王師傅" required />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="account">帳號</Label>
        <Input
          id="account"
          name="account"
          type="text"
          placeholder="例如 ting201314"
          autoCapitalize="none"
          autoCorrect="off"
          spellCheck={false}
          required
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="password">密碼</Label>
        <Input
          id="password"
          name="password"
          type="text"
          placeholder="預設 admin1234"
          defaultValue="admin1234"
        />
      </div>
      <div className="space-y-1.5">
        <Label htmlFor="role">角色</Label>
        <Select id="role" name="role" defaultValue="technician">
          <option value="technician">師傅</option>
          <option value="manager">管理員</option>
          <option value="owner">老闆</option>
        </Select>
      </div>
      <div className="space-y-1.5 flex flex-col">
        <Label>&nbsp;</Label>
        <Button type="submit" disabled={pending}>
          <Plus className="h-4 w-4" /> {pending ? "建立中…" : "建立"}
        </Button>
      </div>
    </form>
  );
}
