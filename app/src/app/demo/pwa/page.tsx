import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";
import { PhoneFrame } from "./PhoneFrame";

export const metadata = {
  title: "師傅 PWA 示範 — 淨新洗衣",
};

export default async function DemoPWAPage() {
  const me = await getCurrentUser();
  if (!me) redirect("/login?next=/demo/pwa");
  return <PhoneFrame userName={me.profile.name} />;
}
