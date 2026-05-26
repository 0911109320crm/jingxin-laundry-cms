import csv, collections

with open('out/orders.csv', encoding='utf-8') as f:
    rows = [r for r in csv.DictReader(f)]

big = sorted([r for r in rows if r['total']], key=lambda r: -float(r['total']))[:10]
print('=== 金額 Top 10 訂單（疑似錯資料）===')
for r in big:
    print(f"  {r['order_code']} | {r['service_at'][:10]} | NT$ {float(r['total']):>12,.0f}")
    print(f"    note: {r['note'][:80]}")
    print()

# 2021 異常
y2021 = [r for r in rows if r['service_at'][:4] == '2021']
print(f'2021 年訂單: {len(y2021)} 筆（鄰年 2000+）')
sample = collections.Counter()
for r in y2021[:200]:
    src = r['note'][:35]
    sample[src] += 1
print('來源樣本:')
for s, c in sample.most_common(5):
    print(f'  {s}: {c}')

# 訂單來源（source 欄位）— 看那些是怪的
src_short = [r['source'] for r in rows if r['source'] and len(r['source']) <= 2]
print(f'\n=== source 欄位 <=2 字元的訂單: {len(src_short)} 筆（疑似誤抓）===')
sc = collections.Counter(src_short)
for s, c in sc.most_common(15):
    print(f'  "{s}": {c}')
