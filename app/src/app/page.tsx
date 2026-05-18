import { redirect } from "next/navigation";
import { getCurrentUser } from "@/lib/dal";

export default async function Home() {
  const user = await getCurrentUser();
  if (!user) redirect("/login");
  if (user.profile.role === "technician") redirect("/staff");
  redirect("/dashboard");
}
