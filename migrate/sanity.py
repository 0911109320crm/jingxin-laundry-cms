"""驗證去重結果：高訂單數的客戶 + 抽幾個樣本確認資料正確。"""
import csv
from collections import Counter, defaultdict
from pathlib import Path

OUT = Path(__file__).parent / "out"

# 統計每個 customer 的訂單數
order_by_cust = defaultdict(int)
items_by_cust = defaultdict(int)
with open(OUT / "orders.csv", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        order_by_cust[r["customer_id"]] += 1

with open(OUT / "order_items.csv", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        items_by_cust[r["order_id"]] += 1

cust_by_id = {}
with open(OUT / "customers.csv", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        cust_by_id[r["id"]] = r

# Top 10 訂單數最多的客戶
print("=== Top 10 訂單數最多的客戶 ===")
top = sorted(order_by_cust.items(), key=lambda x: -x[1])[:10]
for cid, n in top:
    c = cust_by_id[cid]
    print(f"  {c['code']:10s} {c['name']:8s} phone={c['phone']:12s} 訂單={n}")

# 訂單分佈
dist = Counter(order_by_cust.values())
print("\n=== 訂單數分佈 ===")
for n_orders in sorted(dist.keys()):
    print(f"  {n_orders:3d} 筆訂單 × {dist[n_orders]:5d} 個客戶")

# 機器分佈
print("\n=== Machine type 分佈 ===")
mtypes = Counter()
with open(OUT / "machines.csv", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        mtypes[r["type"]] += 1
for t, n in mtypes.most_common():
    print(f"  {t:20s} {n}")

# service_code 分佈
print("\n=== service_code 分佈 ===")
codes = Counter()
with open(OUT / "order_items.csv", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        codes[r["service_code"]] += 1
for c, n in codes.most_common():
    print(f"  {c:25s} {n}")

# 地址解析覆蓋率
print("\n=== 地址解析 ===")
parsed = 0
unknown = 0
with open(OUT / "customer_addresses.csv", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        if r["county"] == "未知":
            unknown += 1
        else:
            parsed += 1
print(f"  抽到 county/district: {parsed}")
print(f"  未知地址: {unknown}")
