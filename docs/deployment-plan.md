# 淨新清潔工坊 CMS — 上線部署計劃

> 從現在「本地 dev + seed 假資料」→ 「雲端 prod + 真實資料 + 真實帳號 + 客戶開始用」
> 分 5 個階段，每階段可獨立執行。

---

## Phase 0 — 部署前盤點（半天）

**目標**：確認上線前所有前置條件都齊全，沒有未完成的工作擋路。

### 0.1 Migrations 全部跑過 prod Supabase

依編號順序逐一在 prod Supabase SQL Editor 套用，跑對應的驗證 script：

```
0001_initial_schema.sql
0002_settlement_status.sql
0003_order_duration.sql
0004_cancellation.sql
0005_service_notes.sql
0006_google_review.sql
0007_machine_brands.sql
0008_promotion_points.sql
0009_service_tags_by_machine_type.sql
0010_real_pricing.sql
0011_system_settings.sql
0012_staff_adj_write.sql
0013_referrer_and_machine_address.sql
0014_payroll_commission.sql
0015_staff_machine_write.sql
0016_legacy_service_items.sql
0017_customer_phones.sql
0018_order_duration_minutes.sql
0019_machine_code.sql
```

跑完後執行驗證：

```powershell
cd C:\RenStudio\case\washinmachine\app
node scripts/check-migration-XXXX.mjs  # 對每個有 check script 的跑一次
```

### 0.2 環境變數核對

確認以下都有設好（dev 跟 prod 兩邊）：

| 變數 | 用途 |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase project URL |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Client 端用 |
| `SUPABASE_SERVICE_ROLE_KEY` | Server actions 用（admin 權限）|
| `TZ=Asia/Taipei` | next.config.ts 已設，但**部署平台 env var 也要設** |

### 0.3 其他檢查

- TypeScript build 全綠：`npx next build` 跑完沒紅
- 三竹簡訊申辦進度（不擋上線，功能可後做）
- prod DB schema dump 留底（緊急時可比對）

---

## Phase 1 — 清掉假資料（30 分鐘）

**目標**：把所有測試訂單 / 客戶 / 師傅資料砍掉，DB 回到「空白但 schema 完整」狀態。

### 1.1 砍交易資料（從相依關係的葉節點往根砍）

```sql
truncate table public.order_promotions      cascade;
truncate table public.order_adjustments     cascade;
truncate table public.order_items           cascade;
truncate table public.payroll_adjustments   cascade;
truncate table public.payroll_snapshots     cascade;
truncate table public.reminders             cascade;
truncate table public.orders                cascade;
truncate table public.machines              cascade;
truncate table public.customer_phones       cascade;
truncate table public.customer_addresses    cascade;
truncate table public.customers             cascade;
truncate table public.audit_logs            cascade;
truncate table public.import_logs           cascade;
```

### 1.2 **保留** 的主檔資料（不要砍）

- `service_items`（54 個真實價目，0010 種好的）
- `adjustment_items`（加減項清單）
- `machine_brands`（51 個品牌）
- `promotion_types`（9 種積分）
- `customer_sources`（來源清單）
- `service_tag_presets`（52 個快速標籤）
- `system_settings`（KPI、抽成預設）

### 1.3 砍假帳號

```sql
-- 砍 user_profiles 假帳號
delete from public.user_profiles
where name like '%demo%' or name like '%test%';
```

`auth.users` 假帳號要去 Supabase Dashboard → Authentication → Users 手動刪除。

### 1.4 驗證

- 進 `/customers`、`/orders` 都該是空清單
- 進 `/settings/services` 應該還看得到 54 個服務項目

---

## Phase 2 — 匯入客戶歷史資料（等客戶整理好後）

**目標**：把客戶提供的歷史資料（Excel / 紙本拍照 / 手寫稿）轉成 DB row。

### 2.1 先盤點客戶資料有什麼 / 沒什麼

- 老闆娘會提供什麼？（客戶名單？歷史訂單？兩者都有？）
- 格式：Excel / Google Sheet / 紙本拍照 / 純文字
- 涵蓋年份：多久以前到現在？
- 每筆訂單會有：日期 / 服務項目 / 金額 / 哪位師傅？

### 2.2 設計匯入策略（依資料狀況分支）

| 資料狀況 | 策略 |
|---|---|
| Excel 結構整齊 | 寫一支 `scripts/import-historical.mjs` 跑 batch insert |
| 半結構化（Excel 但欄位不一致） | 用 GPT / Claude 先正規化成標準 CSV，再 import |
| 紙本拍照 | OCR → 人工校正 → import；或直接放棄歷史，只匯入「主檔客戶名單 + 電話地址」 |
| 純客戶名單沒訂單 | 只 import customers，歷史訂單空白（系統從上線後算起） |

### 2.3 匯入順序（避免外鍵錯誤）

1. customers
2. customer_addresses
3. customer_phones
4. machines
5. orders + order_items + order_adjustments（必須對齊既有 service_items.code）

### 2.4 重點：歷史訂單對 `service_items.code` 的映射

- 老闆娘以前的「滾筒洗 LG 17kg」要對到 `WD-L1`
- 寫個 mapping 表 `legacy_service_map.csv`：`舊名稱 → 新 service_items.code`
- 對不到的記錄為 `LEGACY-OTHER`（已有 0016_legacy_service_items 處理）

### 2.5 匯入後驗證

- 客戶數對得起來
- 抽 10 筆訂單核對：金額、日期、客戶名
- 既有 audit log 不能有 import 之外的寫入

### 2.6 風險防護

- **匯入前 backup**：Supabase Dashboard → Database → Backups 點一下 manual backup
- **匯入跑 dry-run mode**：腳本先印出要插入什麼但不真的 insert，肉眼檢查 5-10 筆再正式跑
- **包在 transaction**：腳本失敗時整批 rollback，不要留半套資料

---

## Phase 3 — 部署到雲端（半天）

### 3.1 選擇平台

- **建議 Netlify**（CLAUDE.md 提到主機是 Netlify）
- 或 Vercel（Next.js 原生支援）

### 3.2 部署步驟

1. **GitHub repo** 確認所有 commit 推上去
2. **Netlify 連 repo** → 自動偵測 Next.js
3. **設環境變數**：
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `SUPABASE_SERVICE_ROLE_KEY`
   - `TZ=Asia/Taipei`
4. **網域**：使用子網域如 `cms.renstudio.tw` 或客戶自有網域（需 DNS 設定）
5. **HTTPS** 自動由平台處理（Let's Encrypt）
6. **第一次 build**：看 build log 確認沒紅
7. **PWA 確認**：師傅手機開網址 → 加到主畫面 → 確認 manifest / service worker 正常

### 3.3 部署後立刻驗證

- 開首頁 → 看得到登入畫面
- 登入測試帳號 → 進 dashboard → 數字都是 0 / 空（Phase 1 已清資料）
- 各頁面巡一遍：customers / orders / calendar / payroll / settings → 不能有 500 error
- **時區檢查**：用瀏覽器建一筆 5/24 09:00 的測試訂單 → 看 /calendar 是否還是 09:00（驗證 `TZ=Asia/Taipei` 在 prod 生效）

---

## Phase 4 — 帳號設定（30 分鐘）

### 4.1 老闆娘 owner 帳號

1. Supabase Dashboard → Authentication → Add User → email + 強密碼
2. 進 SQL Editor 補 user_profiles：

```sql
insert into user_profiles (id, name, role, active)
values ('<auth.users.id>', '老闆娘姓名', 'owner', true);
```

3. **密碼策略**：
   - 不要再用 `admin1234`（demo only）
   - 建議：客戶自己取一個她記得的密碼，至少 10 字元
   - 用密碼管理工具（1Password / Bitwarden）記下來給客戶

### 4.2 師傅帳號（每位一組）

- email：可用 `tech-XXX@renstudio.tw` 之類的內部 email（不需要真實信箱）
- 密碼：給客戶決定，或用 random 8-12 字元給每位師傅一張小卡
- 進 admin `/settings/users` 新增帳號
- 設 role = technician

### 4.3 第一次登入引導

老闆娘登入後逐項看一次：

- `/settings/payroll` 設預設抽成（例如 60%）
- `/settings/services` 確認每個服務項目的抽成
- `/settings/adjustments` 確認加減項的「進薪資」勾選
- `/settings/promotion-types` 確認積分項目

師傅各自登入手機 → 加到主畫面 → 走一輪建單流程。

---

## Phase 5 — 上線測試 + 觀察期（1–2 週）

### 5.1 上線首日陪同

- 老闆娘建第一筆真實訂單（最好你陪在旁邊）
- 拖到月曆派工
- 師傅在 PWA 接單 → 完成 → 收款
- 月底走一遍薪資結算流程

### 5.2 監控

- 每天看 audit log（`/settings/audit`）有沒有異常
- 看 Supabase Dashboard → Logs → API errors
- 看 Netlify 部署 logs

### 5.3 Rollback / 緊急應變

- **資料庫備份**：Supabase 預設每日 backup，緊急時可 restore
- **程式碼 rollback**：Netlify 可一鍵 rollback 到上個版本
- **緊急聯絡**：留你的 LINE / 電話給老闆娘

### 5.4 觀察期收尾（2 週後）

- 收集老闆娘 / 師傅實際使用反饋
- 整理「上線後 bug 清單」優先級
- 決定下一輪迭代範圍（例如 SMS 簡訊批發、報表優化）

---

## 還沒做但要記得的事

1. **三竹簡訊申辦進度**（功能可後做、不擋上線）
2. **客戶端 `cms-features-v2.html` 說明文件**給老闆娘訓練用
3. **資料保留期**：老闆娘想保留多久歷史？這影響 backup 策略
4. **發票 / 收據**：系統目前沒有開立功能，老闆娘現在怎麼處理？要不要加？

---

## 預估時程（從「開始實作」算起）

| 階段 | 工時（人天） | 阻塞點 |
|---|---|---|
| Phase 0 盤點 | 0.5 | — |
| Phase 1 清假資料 | 0.5 | — |
| Phase 2 匯入歷史 | **3–7**（高度依資料品質而定） | **等老闆娘整理資料** |
| Phase 3 部署 | 0.5 | DNS / 網域 |
| Phase 4 帳號 | 0.3 | 客戶決定密碼 |
| Phase 5 上線 + 觀察 | 持續 1–2 週 | — |

**關鍵路徑：Phase 2（等歷史資料）**。其他都可以平行準備。
