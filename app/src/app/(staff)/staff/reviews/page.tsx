import { redirect } from "next/navigation";

export default async function StaffReviewsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const qs = sp.month ? `?month=${encodeURIComponent(sp.month)}` : "";
  redirect(`/staff/scores${qs}`);
}
