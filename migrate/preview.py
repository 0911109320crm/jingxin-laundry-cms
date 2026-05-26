"""快速檢視整合後的舊資料"""
import csv, collections

OUT = 'out'

# === 訂單統計 ===
years = collections.Counter()
totals = []
sources = collections.Counter()
order_per_cust = collections.Counter()
with open(f'{OUT}/orders.csv', encoding='utf-8') as f:
    for row in csv.DictReader(f):
        d = row['service_at'][:4] if row['service_at'] else ''
        years[d] += 1
        try:
            t = float(row['total'])
            if t > 0: totals.append(t)
        except: pass
        if row['source']: sources[row['source']] += 1
        order_per_cust[row['customer_id']] += 1

print('=== 訂單年度分布 ===')
for y in sorted(years):
    print(f'  {y}: {years[y]:>6} 筆')
print(f'  總計: {sum(years.values())} 筆\n')

NT = 'NT$'
print(f'=== 金額統計（>0 的訂單，{len(totals)} 筆）===')
print(f'  總營收: {NT}{sum(totals):,.0f}')
print(f'  平均單價: {NT}{sum(totals)/len(totals):,.0f}')
print(f'  中位數: {NT}{sorted(totals)[len(totals)//2]:,.0f}')
print(f'  最高單筆: {NT}{max(totals):,.0f}\n')

print('=== 訂單來源 Top 10 ===')
for s, c in sources.most_common(10):
    print(f'  {s}: {c}')
print()

# === 縣市 ===
counties = collections.Counter()
districts = collections.Counter()
with open(f'{OUT}/customer_addresses.csv', encoding='utf-8') as f:
    for row in csv.DictReader(f):
        if row['is_default'] == 'true':
            if row['county']: counties[row['county']] += 1
            if row['district']: districts[f"{row['county']}-{row['district']}"] += 1

print('=== 客戶縣市分布（主地址）===')
for c, n in counties.most_common():
    print(f'  {c}: {n}')
print()

print('=== 鄉鎮分布 Top 15 ===')
for d, n in districts.most_common(15):
    print(f'  {d}: {n}')
print()

# === 機型 / 廠牌 ===
machine_types = collections.Counter()
machine_brands = collections.Counter()
with open(f'{OUT}/machines.csv', encoding='utf-8') as f:
    for row in csv.DictReader(f):
        machine_types[row['type']] += 1
        if row['brand']: machine_brands[row['brand']] += 1

print('=== 機型分布 ===')
for t, n in machine_types.most_common():
    print(f'  {t}: {n}')
print()

print('=== 廠牌 Top 20 ===')
for b, n in machine_brands.most_common(20):
    print(f'  {b}: {n}')
print()

# === 回購度 ===
cnt_dist = collections.Counter(order_per_cust.values())
print('=== 客戶下單次數分布 ===')
total_cust = len(order_per_cust)
回購 = sum(1 for v in order_per_cust.values() if v >= 2)
高頻 = sum(1 for v in order_per_cust.values() if v >= 5)
top = sorted(order_per_cust.values(), reverse=True)[:5]
print(f'  總客戶數: {total_cust}')
print(f'  下 1 次: {cnt_dist[1]}')
print(f'  下 2 次: {cnt_dist[2]}')
print(f'  下 3-4 次: {cnt_dist[3]+cnt_dist[4]}')
print(f'  下 5+ 次: {高頻}')
print(f'  最高下單客戶 Top 5 次數: {top}')
print(f'  回購率（>=2 筆）: {回購}/{total_cust} = {回購/total_cust*100:.1f}%')
