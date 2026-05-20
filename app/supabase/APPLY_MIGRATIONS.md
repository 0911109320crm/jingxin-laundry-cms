# 套用 0007-0011 migration（2026-05-21 老闆娘新需求）

## 為什麼要手動套
本專案沒設定 Supabase CLI 連線，migration 一律從 Supabase Dashboard 的 SQL Editor 貼上執行。

## 順序很重要（一定要照順序）
0007 → 0008 → 0009 → 0010 → 0011

跳順序可能因為相依關係（e.g., 0008 砍 0006 加的欄位）而失敗。

## 步驟

1. 開 https://supabase.com/dashboard/project/fjjcglsnzjfhohxpvfbp
2. 左側 SQL Editor → New query
3. 對每個 migration 重複：
   - 從 `app/supabase/migrations/000X_xxx.sql` 整個檔案複製
   - 貼進 SQL Editor → Run（右下角按鈕）
   - 看綠色 Success 訊息
4. 全部跑完，回到本地專案資料夾，跑驗證 script：

```powershell
cd C:\RenStudio\case\washinmachine\app
node scripts/check-migration-0007.mjs
node scripts/check-migration-0008.mjs
node scripts/check-migration-0009.mjs
node scripts/check-migration-0010.mjs
node scripts/check-migration-0011.mjs
```

每個 script 都應該顯示 ✅。如果有 ❌：
- 看訊息 → 通常是 migration 沒跑完或漏跑前一個
- 不要硬改 schema，重新跑該 migration 即可

## 每個 migration 在做什麼

| # | 檔名 | 摘要 | 不可逆？ |
|---|------|------|---------|
| 0007 | machine_brands | 新建品牌主檔 + 51 筆 seed | 可逆 |
| 0008 | promotion_points | **砍 orders 3 欄**（got_5star_review / reviewed_at / review_credited_to）+ 建 promotion_types / order_promotions | **不可逆**：舊 boolean 五星標記資料會消失 |
| 0009 | service_tags_by_machine_type | 加 service_tag_presets.category 欄 + truncate 重 seed 52 個按機型分組標籤 | 舊 7 個全域 seed 消失（但 orders.service_tags 陣列是快照，舊訂單標記不受影響） |
| 0010 | real_pricing | **truncate service_items 重 seed 54 筆** + 新增 6 個 adjustment_items | 舊 5 個 service_items 消失（demo 階段 OK），舊訂單明細用的是 unit_price 快照所以不受影響 |
| 0011 | system_settings | 新建 system_settings 表 + seed 月 KPI=3 + customer_sources 加「FB 地方社團」 | 可逆 |

## 失敗復原

若 0008 跑失敗（例如 RLS policy 衝突），先在 SQL Editor 跑：

```sql
-- 砍掉新加的表（如果存在）回到 0007 狀態
drop table if exists public.order_promotions cascade;
drop table if exists public.promotion_types cascade;
-- 然後重新跑 0008.sql
```

其他 migration 類似邏輯：若中途失敗，drop 該 migration 加的 object，再重跑。

## 跑完之後

跑 dev server 確認 UI 正常：

```cmd
雙擊 start-all.bat
```

打開 http://localhost:3000 → 登入 → 確認：
- /settings/machine-brands 可以看到品牌列表
- /settings/promotion-types 可以看到 9 種促銷
- /scores 排行榜可正常開啟
- /staff/order/[id] 標籤多選按機型自動過濾
