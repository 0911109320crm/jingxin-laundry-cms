"""列出前 5 個客戶的詳細資料給使用者去後台對照。"""
import csv
from collections import defaultdict
from pathlib import Path

OUT = Path(__file__).parent / "out"

with open(OUT / "customers.csv", encoding="utf-8-sig") as f:
    customers = list(csv.DictReader(f))[:5]
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

items_by_order = defaultdict(list)
with open(OUT / "order_items.csv", encoding="utf-8-sig") as f:
    for r in csv.DictReader(f):
        if r["order_id"] in order_id_to_cust:
            items_by_order[r["order_id"]].append(r)

SVC_LABEL = {
    "OLD-WASHER-VERTICAL": "直立式洗衣機",
    "OLD-WASHER-DRUM": "滾筒洗衣機",
    "OLD-AC": "冷氣",
    "OLD-MATTRESS": "床墊",
    "OLD-SOFA": "沙發",
}

for c in customers:
    print(f"\n{'='*70}")
    print(f"客戶 {c['code']}  {c['name']}  電話: {c['phone']}")
    print(f"  joined_at: {c['joined_at']}")
    if c["note"]:
        print(f"  note: {c['note']}")
    print(f"  地址:")
    for a in addresses[c["id"]]:
        flag = "[預設]" if a["is_default"] == "true" else ""
        print(f"    - {a['county']}{a['district']}{a['address']} {flag}")
    print(f"  機器:")
    for m in machines[c["id"]]:
        print(f"    - {m['type']}  {m['brand'] or '(無品牌)'}")
    print(f"  訂單（{len(orders[c['id']])} 筆）:")
    for o in sorted(orders[c["id"]], key=lambda x: x["service_at"]):
        date = o["service_at"][:10]
        print(f"    {o['order_code']}  {date}  ${o['total']}  {o['payment_method']}")
        for it in items_by_order[o["id"]]:
            print(f"      └ {SVC_LABEL.get(it['service_code'], it['service_code'])} ${it['unit_price']}  ({it['note']})")
