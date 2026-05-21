import { requireRole } from "@/lib/dal";
import { createAdminClient } from "@/lib/supabase/admin";
import { Card, CardBody, CardHeader, CardTitle } from "@/components/ui/Card";
import { UserRow, type UserItem } from "./UserRow";
import { NewUserForm } from "./NewUserForm";

export default async function UsersSettingsPage() {
  const me = await requireRole(["owner"]);
  const admin = createAdminClient();

  const [{ data: profiles }, { data: authData }] = await Promise.all([
    admin
      .from("user_profiles")
      .select("id, name, phone, role, active")
      .order("role")
      .order("name"),
    admin.auth.admin.listUsers({ perPage: 200 }),
  ]);

  const emailById = new Map<string, string | null>(
    (authData?.users ?? []).map((u) => [u.id, u.email ?? null]),
  );

  const users: UserItem[] =
    (profiles ?? []).map((p) => {
      const profile = p as {
        id: string;
        name: string;
        phone: string | null;
        role: UserItem["role"];
        active: boolean;
      };
      return {
        id: profile.id,
        name: profile.name,
        phone: profile.phone,
        role: profile.role,
        active: profile.active,
        email: emailById.get(profile.id) ?? null,
      };
    }) ?? [];

  return (
    <div className="p-6 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">帳號管理</h1>
        <p className="text-sm text-zinc-500">
          僅老闆可進入。新建帳號預設密碼為 <code>admin1234</code>，請告知對方登入後自行更改。
        </p>
      </header>

      <Card>
        <CardHeader>
          <CardTitle>新增帳號</CardTitle>
        </CardHeader>
        <CardBody>
          <NewUserForm />
        </CardBody>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>帳號清單（{users.length}）</CardTitle>
        </CardHeader>
        <CardBody className="p-0">
          <div className="grid grid-cols-[1fr_1fr_1fr_120px_80px_auto] gap-2 border-b border-zinc-200 bg-zinc-50 px-5 py-2 text-xs font-medium uppercase tracking-wider text-zinc-500">
            <div>姓名</div>
            <div>Email</div>
            <div>電話</div>
            <div>角色</div>
            <div>狀態</div>
            <div></div>
          </div>
          {users.length === 0 ? (
            <p className="p-5 text-sm text-zinc-500">尚無資料</p>
          ) : (
            <ul className="divide-y divide-zinc-200">
              {users.map((u) => (
                <li key={u.id}>
                  <UserRow user={u} isSelf={u.id === me.id} />
                </li>
              ))}
            </ul>
          )}
        </CardBody>
      </Card>
    </div>
  );
}
