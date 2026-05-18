import Link from "next/link";

export default function UnauthorizedPage() {
  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-md text-center space-y-3">
        <h1 className="text-2xl font-bold text-zinc-900">沒有存取權限</h1>
        <p className="text-sm text-zinc-500">
          您的帳號角色無法存取此頁面，請聯絡老闆。
        </p>
        <Link
          href="/"
          className="inline-block rounded-lg bg-brand-600 px-5 py-2 text-sm font-medium text-white hover:bg-brand-700"
        >
          回首頁
        </Link>
      </div>
    </div>
  );
}
