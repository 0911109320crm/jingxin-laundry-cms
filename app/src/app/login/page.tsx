import Image from "next/image";
import { LoginForm } from "./LoginForm";

type SearchParams = Promise<{ next?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center bg-gradient-to-b from-brand-50 to-white px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="flex flex-col items-center space-y-3 text-center">
          <Image
            src="/logo.png"
            alt="淨新清潔工坊"
            width={120}
            height={120}
            priority
            className="h-28 w-28 drop-shadow-sm"
          />
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-zinc-900">
              淨新清潔工坊管理系統
            </h1>
            <p className="text-sm text-zinc-500">請輸入帳號密碼登入</p>
          </div>
        </div>
        <LoginForm next={next ?? "/"} />
      </div>
    </div>
  );
}
