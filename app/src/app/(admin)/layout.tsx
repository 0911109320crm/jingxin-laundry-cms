import { redirect } from "next/navigation";
import { Sidebar } from "@/components/Sidebar";
import { GlobalSearch } from "@/components/GlobalSearch";
import { getCurrentUser } from "@/lib/dal";

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile.role === "technician") redirect("/staff");

  return (
    <div className="flex min-h-screen w-full flex-col lg:flex-row">
      <Sidebar userName={user.profile.name} />
      <main className="flex-1 overflow-auto bg-zinc-50">{children}</main>
      <GlobalSearch />
    </div>
  );
}
