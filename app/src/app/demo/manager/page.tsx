import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { ManagerPhoneFrame } from "./ManagerPhoneFrame";

export const metadata = {
  title: "老闆娘 PWA 示範 — 淨新清潔工坊",
};

export default async function DemoManagerPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login?next=/demo/manager");
  // 預覽用，不擋 owner 以外角色（owner 才能真實看到內容；其他角色 iframe 內會被 layout 導去 /unauthorized）
  return <ManagerPhoneFrame userName={me.profile.name} role={me.profile.role} />;
}
