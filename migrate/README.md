# 舊客戶資料遷移管線

把 2016~2023 的 Excel 顧客名單統整成 CMS 可匯入的客戶 / 訂單資料。

## 流程

```
顧客名單/cleaned/*.xlsx
        │
        ▼
  step1_extract.py        ─ 讀 8 個 xlsx，輸出 raw_rows.csv（每列一訂單）
        │
        ▼
  step2_normalize.py      ─ 解析電話/地址/品牌/金額/項目 → normalized_rows.csv
        │
        ▼
  step3_build.py          ─ 客戶去重、產 OLD- 編號 → customers.csv / orders.csv / order_items.csv
        │                  + manual_review.xlsx（無電話、需人工核對）
        ▼
  step4_import.py         ─ 灌 Supabase（含 dry-run）
```

## 編號規則

- 客戶 code：`OLD-{5位流水}` （例：`OLD-00001`）
- 訂單 code：`OLD-{YYYYMMDD}-{NNN}` （例：`OLD-20190824-001`）

## 客戶去重

主鍵：**正規化電話**（去除非數字、補 0、拆多支電話取首支）
無電話：另存 `manual_review.xlsx`，不進主檔。
