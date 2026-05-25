"""
讀「訂單資料_全部9857筆.csv」(舊系統 export) → legacy_rows.csv → merge 進 rows.csv

格式對照（csv 欄位 → rows.csv schema）：
  清洗日期 (YYYY.MM.DD) → date
  姓名                  → name
  電話 (可能少前 0)     → phones (normalize)
  地址                  → addresses
  項目                  → item_raw
  廠牌                  → brand_raw
  付款方式              → payment
  金額 ($1,800)         → amount_raw (去 $ 跟逗號)
  增加 ($200 (大台+200))→ note (合進去)
  折扣                  → note
  實收                  → actual_amount
  服務人員 (阿翰)        → staff_name
  清洗編號 (115-EA247)  → legacy_code
  備註                  → 一起合進 brand_raw / note

去重策略：以 (主電話, YYYY-MM-DD) 為 key。
重疊 cleaned/gform 的 → 移除 cleaned/gform 那筆，以 legacy 為主（更權威）。
"""
from __future__ import annotations
import csv
import re
from datetime import datetime
from pathlib import Path

from extract import normalize_phones, clean_address


LEGACY_CSV = Path(r"C:\RenStudio\case\washinmachine\訂單資料_全部9857筆.csv")
ROWS_CSV = Path(__file__).parent / "out" / "rows.csv"
OUT_CSV = Path(__file__).parent / "out" / "legacy_rows.csv"

HEADERS = [
    "source_file", "sheet", "row_no", "format",
    "date", "name", "phones", "addresses",
    "brand_raw", "amount_raw", "item_raw", "payment", "source", "machine_id",
    "legacy_code", "staff_name", "actual_amount",
]


def parse_money(s: str) -> str:
    """'$1,800' → '1800', '$2,500' → '2500'"""
    if not s:
        return ""
    digits = re.sub(r"[^\d.]", "", str(s))
    return digits


def parse_payment(s: str) -> str:
    if not s:
        return ""
    s = str(s).strip()
    if "現金" in s:
        return "cash"
    if "轉帳" in s or "匯款" in s:
        return "transfer"
    if "刷卡" in s or "信用卡" in s:
        return "card"
    if "line" in s.lower():
        return "line_pay"
    return ""


def main():
    print(f"讀 {LEGACY_CSV.name}")
    n_total = 0
    n_skipped = 0
    n_written = 0

    with open(LEGACY_CSV, encoding="utf-8-sig") as src, \
         open(OUT_CSV, "w", encoding="utf-8-sig", newline="") as dst:
        w = csv.DictWriter(dst, fieldnames=HEADERS)
        w.writeheader()
        reader = csv.DictReader(src)
        for r_idx, r in enumerate(reader, start=2):
            n_total += 1
            # 日期：2026.05.23 → 2026-05-23
            date_str = r["清洗日期"].strip()
            try:
                dt = datetime.strptime(date_str, "%Y.%m.%d")
                date_iso = dt.strftime("%Y-%m-%d")
            except ValueError:
                date_iso = ""

            name = r["姓名"].strip()
            phones = normalize_phones(r["電話"])
            # 地址：呼叫 clean_address 去 ZIP 前綴 (例 "647雲林縣..." → "雲林縣...")
            addr_list = clean_address(r["地址"])
            address = "|".join(addr_list)
            item = r["項目"].strip()
            brand = r["廠牌"].strip()
            payment = parse_payment(r["付款方式"])
            amount = parse_money(r["金額"])
            addon_raw = r["增加"].strip()
            disc_raw = r["折扣"].strip()
            actual = parse_money(r["實收"])
            staff = r["服務人員"].strip()
            legacy_code = r["清洗編號"].strip()
            note_field = r["備註"].strip()

            if not (name or phones or address or item or brand):
                n_skipped += 1
                continue

            # 增加項 / 折扣項 合進 item_raw 後段（保留資訊給之後解析）
            # build.py 還沒處理 actual_amount，所以暫時把 addon/disc 也合進 item_raw
            extras = "|".join(x for x in (addon_raw, disc_raw, note_field) if x)
            item_combined = item + (f" | {extras}" if extras else "")

            w.writerow({
                "source_file": "訂單資料_全部9857筆.csv",
                "sheet": "legacy",
                "row_no": r_idx,
                "format": "L",  # L = Legacy system export
                "date": date_iso,
                "name": name,
                "phones": "|".join(phones),
                "addresses": address,
                "brand_raw": brand,
                "amount_raw": amount,
                "item_raw": item_combined,
                "payment": payment,
                "source": "",
                "machine_id": "",
                "legacy_code": legacy_code,
                "staff_name": staff,
                "actual_amount": actual,
            })
            n_written += 1

    print(f"\n總列數:   {n_total}")
    print(f"空白跳過: {n_skipped}")
    print(f"寫出:     {n_written} → {OUT_CSV.name}")

    # ---- 合進 rows.csv：legacy 為主，刪掉重複的 cleaned/gform ----
    if ROWS_CSV.exists() and n_written > 0:
        # 讀 legacy
        with open(OUT_CSV, encoding="utf-8-sig") as f:
            legacy_rows = list(csv.DictReader(f))
        legacy_keys = set()
        for r in legacy_rows:
            phones = (r["phones"] or "").split("|")
            if phones[0] and r["date"]:
                legacy_keys.add((phones[0], r["date"][:7]))  # 月份精度

        # 讀 rows.csv 排除：legacy 自己之前的 + 跟 legacy 重複的
        with open(ROWS_CSV, encoding="utf-8-sig") as f:
            old_rows = []
            removed_dup = 0
            removed_old_legacy = 0
            for r in csv.DictReader(f):
                if r["source_file"] == "訂單資料_全部9857筆.csv":
                    removed_old_legacy += 1
                    continue
                phones = (r["phones"] or "").split("|")
                if phones[0] and r["date"] and (phones[0], r["date"][:7]) in legacy_keys:
                    removed_dup += 1
                    continue
                old_rows.append(r)

        merged = old_rows + legacy_rows
        with open(ROWS_CSV, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=HEADERS)
            w.writeheader()
            for r in merged:
                w.writerow(r)

        print(f"\n合併進 rows.csv：")
        print(f"  舊 rows.csv 移除舊版 legacy: {removed_old_legacy}")
        print(f"  舊 rows.csv 移除跟 legacy 重複: {removed_dup}")
        print(f"  保留 cleaned/gform: {len(old_rows)}")
        print(f"  加入 legacy: {len(legacy_rows)}")
        print(f"  rows.csv 總計: {len(merged)}")


if __name__ == "__main__":
    main()
