# 「現場拆訂單」功能 spec（中途調整訂單 — 方案 1）

## 情境

老闆娘接單時：王太太預約「4 台洗衣機清洗」。
師傅到現場：王太太說「我只有 2 台要洗，另外 2 台改幫隔壁鄰居洗」。

## 目標

讓師傅在 PWA 現場用手機**一鍵建鄰居訂單**，
不破壞原訂單的結構，會計帳上分清楚誰付了什麼。

---

## UX 流程

### 起點：師傅在訂單詳細頁
原訂單 `20260524-006`：
```
┌─────────────────────────────────────┐
│ 20260524-006  王太太  04-1234567    │
│ 09:00-10:30                         │
│ ─ 機器 ───────────────────────────  │
│ ☐ 20260524-006-1 直立式 LG    1600 │
│ ☐ 20260524-006-2 直立式 國際  1600 │
│ ☐ 20260524-006-3 直立式 三洋  1600 │
│ ☐ 20260524-006-4 直立式 東元  1600 │
│                                     │
│ [完成此單]  [建鄰居訂單 ➕]         │
└─────────────────────────────────────┘
```

### 點「建鄰居訂單 ➕」彈出 modal
```
┌─────────────────────────────────────┐
│ 從這張訂單拆出 → 新訂單             │
│                                     │
│ 哪幾台是要給鄰居的？                │
│   ☐ 20260524-006-3 直立式 三洋 1600 │
│   ☐ 20260524-006-4 直立式 東元 1600 │
│                                     │
│ 鄰居姓名: _____________ *           │
│ 鄰居電話: _____________ *           │
│ 地址: ⊙ 同王太太地址              │
│       ⊙ 別的地址（再填）           │
│                                     │
│ [確定建立]  [取消]                  │
└─────────────────────────────────────┘
```

### 確定後系統做的事
1. **新建客戶**（最小欄位：姓名 + 電話 + 地址）
2. **新建訂單** `20260524-007`，scheduled_at = 原訂單同時段
3. **新訂單 items** 複製選中的 items（service_item / brand / price 都帶過去），item_code 自動產生為 `20260524-007-1`, `-2`
4. **原訂單 items** 標記 `transferred_to_order_id` 指向新訂單（不刪除）
5. **原訂單金額重算**：被轉走的不再計入 subtotal
6. 師傅 PWA 跳回原訂單，現在顯示「2 台 + 2 台已轉至 20260524-007」

---

## Schema 變更

### 新欄位：`order_items.transferred_to_item_id`
```sql
alter table public.order_items
  add column transferred_to_item_id uuid
    references public.order_items(id) on delete set null;

create index idx_items_transferred
  on public.order_items (transferred_to_item_id)
  where transferred_to_item_id is not null;

comment on column public.order_items.transferred_to_item_id is
  '若此 item 中途轉給其他訂單（例如現場 4 台只洗 2 台、另 2 台給鄰居）→ 指向新訂單的對應 item。原 item 保留作審計用、subtotal 計算時排除。';
```

### `refresh_order_totals` trigger 改：被轉走的 item 不計
```sql
-- 原本：select sum(subtotal) from order_items where order_id = X
-- 改成：where order_id = X and transferred_to_item_id is null
```

---

## 後端 API

### `POST /api/orders/:id/split`
```typescript
{
  item_ids: string[],        // 要轉走的 item ids
  customer: {                // 新建客戶（最小）
    name: string,
    phone: string,
  },
  address: {                 // 新訂單地址
    use_original: boolean,   // true = 用原訂單地址
    county?: string,         // 否則自填
    district?: string,
    address?: string,
  },
}
→ Response: { new_order_id, new_order_code }
```

### Action 在 server 做
1. 開 transaction
2. Insert customer (with auto OLD-NEW-NNNNN code or NEW-NNNNN code)
3. Insert customer_addresses
4. Insert customer_phones
5. Insert order (scheduled_at 同原訂單)
6. Insert order_items 複製選中（item_code 自動）
7. Update 原 order_items 設 transferred_to_item_id
8. Trigger 會自動 refresh totals
9. Commit

---

## UI 元件

### 新元件
- `<TransferToNeighborDialog>` — modal 表單
- `<TransferredBadge>` — 在 item row 顯示「→ 已轉 20260524-007-1」灰色

### 改動既有
- `staff/order/[id]/page.tsx` — 加「建鄰居訂單 ➕」按鈕
- `staff/order/[id]/OrderWorkflow.tsx` — checklist 顯示 transferred 狀態
- `admin/orders/[id]/page.tsx` — 也顯示拆分鏈（看見原單跟新單關係）

---

## 邊界 case

| Case | 處理 |
|---|---|
| 鄰居名字不知道 | 必填 → 就寫「(鄰居) 王太太隔壁」 |
| 鄰居電話不知道 | 必填 → 寫王太太的電話 + 註記「鄰居共用」 |
| 拆出後反悔 | admin 後台可從新訂單按「合併回原訂單」（v2 再做） |
| 鄰居後續想單獨預約 | 已有 customer 紀錄了，老闆娘搜尋電話即可 |
| 同地址多次拆 | 允許 — 每次拆都新建一筆 customer（若同電話會在客戶頁 union） |

---

## 工程量估計

| 任務 | 時間 |
|---|---|
| Schema migration (transferred_to_item_id + trigger 改) | 30 分 |
| Backend: `splitOrderAction` server action | 1 小時 |
| Frontend: `<TransferToNeighborDialog>` 元件 | 1 小時 |
| 整合到 staff/order 頁 + 顯示 transferred badge | 30 分 |
| admin 頁顯示拆分鏈 | 30 分 |
| 測試 + 邊界 case | 30 分 |
| **總計** | **約 4 小時** |

---

## 待你確認的小細節

1. **新建鄰居客戶的 code 規則**？目前打算用 `NEW-YYYYMMDD-NN`，跟匯入舊資料的 `OLD-XXXXX` 區隔
2. **新訂單 scheduled_at 是否預設帶原訂單**？我會這樣做，你回來確認
3. **鄰居電話必填**？嚴格說可選，但沒電話之後找不到人，所以建議必填（必要時填王太太的）
