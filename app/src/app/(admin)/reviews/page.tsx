import { redirect } from "next/navigation";

export default async function ReviewsRedirectPage({
  searchParams,
}: {
  searchParams: Promise<{ month?: string }>;
}) {
  const sp = await searchParams;
  const qs = sp.month ? `?month=${encodeURIComponent(sp.month)}` : "";
  redirect(`/scores${qs}`);
}
