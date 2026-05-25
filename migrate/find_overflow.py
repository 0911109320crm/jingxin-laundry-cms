"""找出金額超過 numeric(10,2) 上限 (99,999,999.99) 的訂單與明細。"""
import csv
from pathlib import Path

OUT = Path(__file__).parent / "out"
LIMIT = 99_999_999.99

print("=== orders.csv 異常金額 ===")
with open(OUT / "orders.csv", encoding="utf-8-sig") as f:
    bad_orders = []
    for r in csv.DictReader(f):
        try:
            sub = float(r["subtotal"])
            adj = float(r["adjustments_total"])
            tot = float(r["total"])
        except (ValueError, KeyError):
            continue
        if sub > LIMIT or adj > LIMIT or abs(tot) > LIMIT or sub < 0 or tot < 0:
            bad_orders.append({
                "id": r["id"][:8],
                "code": r["order_code"],
                "subtotal": sub,
                "total": tot,
                "note": r["note"][:60],
            })

print(f"  共 {len(bad_orders)} 筆異常")
for b in bad_orders[:30]:
    print(f"  {b['code']:20s} subtotal={b['subtotal']:>20,.2f} total={b['total']:>20,.2f}  {b['note']}")

print("\n=== order_items.csv 異常金額 ===")
with open(OUT / "order_items.csv", encoding="utf-8-sig") as f:
    bad_items = []
    for r in csv.DictReader(f):
        try:
            up = float(r["unit_price"])
            st = float(r["subtotal"])
        except (ValueError, KeyError):
            continue
        if up > LIMIT or st > LIMIT or up < 0 or st < 0:
            bad_items.append({
                "id": r["id"][:8],
                "order_id": r["order_id"][:8],
                "unit_price": up,
                "subtotal": st,
                "note": r["note"][:60],
            })
print(f"  共 {len(bad_items)} 筆異常")
for b in bad_items[:30]:
    print(f"  {b['id']} order={b['order_id']} unit_price={b['unit_price']:>20,.2f}  {b['note']}")

# 也檢查 rows.csv 的 amount_raw 怪的
print("\n=== rows.csv amount_raw 解析後超大的 ===")
import re
def parse_amounts(s):
    if not s: return []
    parts = re.split(r"\s*[+＋]\s*", str(s).strip())
    out = []
    for p in parts:
        p = p.strip()
        if not p: continue
        m = re.match(r"^(\d+(?:\.\d+)?)\s*[*×xX]\s*(\d+)$", p)
        if m:
            out.append((float(m.group(1)), int(m.group(2))))
            continue
        n = re.sub(r"[^\d.]", "", p)
        if n:
            try: out.append((float(n), 1))
            except ValueError: pass
    return out

with open(OUT / "rows.csv", encoding="utf-8-sig") as f:
    weird = []
    for r in csv.DictReader(f):
        amts = parse_amounts(r["amount_raw"])
        if not amts:
            continue
        total = sum(p * q for p, q in amts)
        if total > LIMIT or any(p > LIMIT for p, _ in amts) or any(q > 100 for _, q in amts):
            weird.append({
                "source": r["source_file"][:20],
                "sheet": r["sheet"],
                "row": r["row_no"],
                "name": r["name"],
                "amount_raw": r["amount_raw"],
                "parsed_total": total,
            })

print(f"  共 {len(weird)} 筆")
for w in weird[:30]:
    print(f"  [{w['source']} {w['sheet']} r{w['row']}] {w['name']:8s}  amount={w['amount_raw']!r}  → total={w['parsed_total']:,.2f}")
