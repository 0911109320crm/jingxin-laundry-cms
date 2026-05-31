import { type NextRequest, NextResponse } from "next/server";
import { updateSession } from "@/lib/supabase/middleware";

/**
 * Next.js 16 proxy (was middleware.ts).
 * - Refreshes Supabase session cookies on every request.
 * - Redirects unauthenticated users away from protected routes.
 * - DOES NOT enforce role-based access — that lives in Server Components / Actions.
 */
export async function proxy(request: NextRequest) {
  const { response, user } = await updateSession(request);
  const { pathname } = request.nextUrl;

  const isPublic =
    pathname === "/login" ||
    pathname === "/unauthorized" ||
    pathname.startsWith("/api/health") ||
    pathname.startsWith("/_next") ||
    pathname === "/favicon.ico" ||
    pathname === "/manifest.webmanifest";

  if (isPublic) return response;

  if (!user) {
    const url = request.nextUrl.clone();
    url.pathname = "/login";
    if (pathname !== "/") url.searchParams.set("next", pathname);
    return NextResponse.redirect(url);
  }

  // 查帳唯讀帳號（app_metadata.readonly）：只能瀏覽 /customers 與 /orders 的「檢視」頁，
  // 擋掉會繞過 RLS 的分析頁(dashboard/reports/payroll…)與所有新增/編輯頁。
  // 資料層另有 RLS 只給成立日後資料 + 寫入封鎖，這裡是第二道防線(縮小可達範圍)。
  const isReadonly = Boolean(
    (user.app_metadata as { readonly?: boolean } | undefined)?.readonly,
  );
  if (isReadonly) {
    const viewable =
      (pathname === "/customers" ||
        pathname.startsWith("/customers/") ||
        pathname === "/orders" ||
        pathname.startsWith("/orders/")) &&
      !pathname.endsWith("/new") &&
      !pathname.endsWith("/edit");
    if (!viewable) {
      const url = request.nextUrl.clone();
      url.pathname = "/customers";
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  return response;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:png|jpg|jpeg|gif|svg|ico|webp|webmanifest)$).*)",
  ],
};
