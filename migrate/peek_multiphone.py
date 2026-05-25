"""列出 5 個有副電話的樣本客戶（跟 import --sample-multiphone 同一批）。"""
import csv
from collections import defaultdict
from pathlib import Path

OUT = Path(__file__).parent / "out"

# 仿造 import 邏輯：先讀 phones、找出 >=2 支的 customer，取前 5
phones_by_cust = defaultdict(list)
with open(OUT / "customer_phones.csv", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        phones_by_cust[r["customer_id"]].append(r)

customers = []
with open(OUT / "customers.csv", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        if len(phones_by_cust.get(r["id"], [])) >= 2:
            customers.append(r)
            if len(customers) == 5:
                break

cust_ids = {c["id"] for c in customers}

addresses = defaultdict(list)
with open(OUT / "customer_addresses.csv", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        if r["customer_id"] in cust_ids:
            addresses[r["customer_id"]].append(r)

machines = defaultdict(list)
with open(OUT / "machines.csv", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        if r["customer_id"] in cust_ids:
            machines[r["customer_id"]].append(r)

orders = defaultdict(list)
order_id_to_cust = {}
with open(OUT / "orders.csv", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        if r["customer_id"] in cust_ids:
            orders[r["customer_id"]].append(r)
            order_id_to_cust[r["id"]] = r["customer_id"]

for c in customers:
    print(f"\n{'='*72}")
    print(f"客戶 {c['code']}  {c['name']}")
    print(f"  電話（{len(phones_by_cust[c['id']])} 支）:")
    for p in sorted(phones_by_cust[c["id"]], key=lambda x: int(x["sort_order"])):
        flag = "[主]" if p["is_primary"] == "true" else "[副]"
        label = f"  ({p['label']})" if p["label"] else ""
        print(f"    {flag} {p['phone']}{label}")
    if c["note"]:
        print(f"  note: {c['note']}")
    print(f"  地址:")
    for a in addresses[c["id"]]:
        flag = "[預設]" if a["is_default"] == "true" else ""
        print(f"    - {a['county']}{a['district']}{a['address']} {flag}")
    print(f"  訂單（{len(orders[c['id']])} 筆）: " +
          ", ".join(o["order_code"] + f" ${o['total']}" for o in sorted(orders[c["id"]], key=lambda x: x["service_at"])))
