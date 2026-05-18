# 淨新洗衣管理系統

淨新洗衣機清潔工坊（彰化田尾）的後台管理系統。

## 技術棧
- Next.js 16 (App Router) + React 19 + TypeScript
- Tailwind CSS v4
- Supabase（Postgres + Auth + RLS）
- Netlify 部署
- PWA（師傅手機端可加到主畫面）

## 開發

```bash
cp .env.local.example .env.local   # 填入 Supabase 三組 key
npm install
npm run dev
```

Dev server: http://localhost:3000

## Supabase 設定步驟

1. 在 Supabase 建立新 Project（region 選 Tokyo 或 Singapore）
2. SQL Editor 執行 `supabase/migrations/0001_initial_schema.sql`
3. Project Settings → API 拿三組 key 填入 `.env.local`
4. 透過 Supabase Studio → Authentication → Users 建立第一個帳號
5. SQL Editor 執行：
   ```sql
   insert into public.user_profiles (id, name, role)
   values ('<auth user id>', '老闆娘', 'owner');
   ```

## 角色
- `owner` — 全權限（帳號管理、所有資料）
- `manager` — 除帳號管理外的全部
- `technician` — 師傅，只看自己案件、現場填收費

## 目錄結構
```
src/
  app/
    (admin)/        後台管理（owner / manager）
    (staff)/        師傅 PWA 介面（technician）
    login/          登入頁
    api/            Route Handlers
  components/       UI 共用元件
  lib/
    supabase/       client / server / middleware
    dal.ts          資料存取層（auth check + role）
    utils.ts        cn / 金額 / 日期格式化
  types/
    database.ts     Supabase schema TS 型別
  proxy.ts          Next 16 proxy（前身為 middleware）
supabase/
  migrations/
    0001_initial_schema.sql
```

## TODO（待客戶提供）
- 換 `public/icon-192.png` 與 `public/icon-512.png`（目前只有 SVG）
- 4 位師傅的真實姓名
- 舊 Excel（2023 年以前）資料

## 部署到 Netlify
1. 推到 GitHub
2. Netlify → New site from Git
3. Build command: `npm run build`
4. Publish directory: `.next`
5. 加上環境變數（同 `.env.local`）
