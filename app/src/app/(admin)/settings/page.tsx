import Link from "next/link";
import { Card, CardBody } from "@/components/ui/Card";

const sections = [
  {
    href: "/settings/users",
    title: "帳號管理",
    desc: "新增 / 停用師傅與管理員帳號",
  },
  {
    href: "/settings/services",
    title: "服務項目",
    desc: "管理服務名稱、預設價格、機器貼紙快速辨識碼",
  },
  {
    href: "/settings/adjustments",
    title: "折扣 / 加價項目",
    desc: "加大、其他加價、折扣等項目",
  },
  {
    href: "/settings/sources",
    title: "客戶來源",
    desc: "LINE / Google / 跟車 / 老客介紹...",
  },
  {
    href: "/settings/service-tags",
    title: "師傅快速備註標籤",
    desc: "管理師傅完成案件時可勾選的快速備註（洗衣粉、無電梯、有廢水…）",
  },
  {
    href: "/settings/audit",
    title: "操作稽核",
    desc: "查看所有寫入 / 刪除 / 取消等敏感操作（僅老闆）",
  },
];

export default function SettingsPage() {
  return (
    <div className="p-8 space-y-4">
      <header>
        <h1 className="text-2xl font-bold text-zinc-900">系統設定</h1>
        <p className="text-sm text-zinc-500">主檔資料維護</p>
      </header>
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        {sections.map((s) => (
          <Link key={s.href} href={s.href}>
            <Card className="transition-shadow hover:shadow-md">
              <CardBody>
                <p className="text-base font-semibold text-zinc-900">
                  {s.title}
                </p>
                <p className="mt-1 text-sm text-zinc-500">{s.desc}</p>
              </CardBody>
            </Card>
          </Link>
        ))}
      </div>
    </div>
  );
}
