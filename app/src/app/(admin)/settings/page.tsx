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
    desc: "管理 54 個真實價目（直立/滾筒/沙發/床墊/分離冷氣/吊隱冷氣）",
  },
  {
    href: "/settings/adjustments",
    title: "折扣 / 加價項目",
    desc: "拆解費、車馬費、液晶+300、疊烘+600、移機費、卡軸+1000、折扣...",
  },
  {
    href: "/settings/machine-brands",
    title: "機型品牌主檔",
    desc: "師傅 PWA 用的品牌下拉選單（4 種機型，51 個品牌）",
  },
  {
    href: "/settings/promotion-types",
    title: "促銷積分",
    desc: "9 種促銷動作對應分數 + 每月 KPI 目標設定",
  },
  {
    href: "/settings/payroll",
    title: "薪資設定",
    desc: "預設抽成 / 計算公式 / 月結說明（個別項目抽成在「服務項目」設定）",
  },
  {
    href: "/settings/sources",
    title: "客戶來源",
    desc: "LINE / Google / FB / FB地方社團 / 跟車 / 老客介紹...",
  },
  {
    href: "/settings/service-tags",
    title: "師傅快速備註標籤",
    desc: "按機型分組（直立/滾筒/冷氣/床墊沙發 共 52 個標籤）",
  },
  {
    href: "/settings/audit",
    title: "操作稽核",
    desc: "查看所有寫入 / 刪除 / 取消等敏感操作（僅老闆）",
  },
];

export default function SettingsPage() {
  return (
    <div className="p-6 space-y-4">
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
