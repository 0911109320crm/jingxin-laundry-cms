"""直接讀原始 訂單資料_全部9857筆.csv，看「清洗編號」欄真實內容"""
import csv
from collections import Counter

SRC = r"C:\RenStudio\case\washinmachine\訂單資料_全部9857筆.csv"

with open(SRC, encoding="utf-8-sig") as f:
    reader = csv.DictReader(f)
    print(f"原始檔欄位: {reader.fieldnames}\n")
    rows = list(reader)

print(f"總列數: {len(rows)}\n")

# 找幾個之前認為「不像清洗編號」的關鍵字，看原始檔他們真的在清洗編號欄嗎
keywords = ["拆不起", "乾淨不洗", "拆解費", "無", "拆後背板", "N577", "M563", "V580", "T504"]

print("=== 在原始檔『清洗編號』欄找這些可疑字串 ===\n")
for kw in keywords:
    hits = [r for r in rows if r.get("清洗編號", "").strip() == kw]
    if hits:
        h = hits[0]
        print(f"『{kw}』 出現 {len(hits)} 次")
        print(f"  原始 row 範例:")
        print(f"    清洗日期: {h.get('清洗日期','')}")
        print(f"    姓名:     {h.get('姓名','')}")
        print(f"    廠牌:     {h.get('廠牌','')}")
        print(f"    項目:     {h.get('項目','')}")
        print(f"    金額:     {h.get('金額','')}")
        print(f"    清洗編號: 「{h.get('清洗編號','')}」")
        print(f"    備註:     {h.get('備註','')}")
        print()

print("\n=== 原始檔『清洗編號』欄整體統計 ===")
codes = [r.get("清洗編號","").strip() for r in rows]
print(f"  總數:           {len(codes)}")
print(f"  空白:           {codes.count('')}")
print(f"  有值:           {sum(1 for c in codes if c)}")

# 看開頭分布
import re
year_p = re.compile(r'^1[012]\d')
year_cnt = sum(1 for c in codes if c and year_p.match(c))
letter_cnt = sum(1 for c in codes if c and re.match(r'^[A-Za-z]', c))
cn_cnt = sum(1 for c in codes if c and re.match(r'^[一-鿿]', c))
print(f"  民國年開頭:     {year_cnt}")
print(f"  英文字母開頭:   {letter_cnt}")
print(f"  中文開頭:       {cn_cnt}")
