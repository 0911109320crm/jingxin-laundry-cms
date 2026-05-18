import { LoginForm } from "./LoginForm";

type SearchParams = Promise<{ next?: string }>;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const { next } = await searchParams;

  return (
    <div className="flex flex-1 items-center justify-center px-4 py-12">
      <div className="w-full max-w-sm space-y-6">
        <div className="text-center space-y-1">
          <h1 className="text-2xl font-bold text-zinc-900">淨新洗衣管理系統</h1>
          <p className="text-sm text-zinc-500">請輸入帳號密碼登入</p>
        </div>
        <LoginForm next={next ?? "/"} />
      </div>
    </div>
  );
}
