import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { ManagerPhoneFrame } from "./ManagerPhoneFrame";

export const metadata = {
  title: "老闆娘 PWA 示範 — 淨新清潔工坊",
};

export default async function DemoManagerPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login?next=/demo/manager");
  // 預覽工具僅供老闆娘/管理者；師傅不得進入
  if (me.profile.role === "technician") redirect("/staff");
  return <ManagerPhoneFrame userName={me.profile.name} role={me.profile.role} />;
}
