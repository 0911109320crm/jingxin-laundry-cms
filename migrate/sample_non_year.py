"""列 20 個不同類型的非年份開頭 legacy_code，含上下文 (日期/姓名)"""
import csv, re
from collections import defaultdict

with open('out/clean/orders.csv', encoding='utf-8') as f:
    orders = list(csv.DictReader(f))
with open('out/clean/customers.csv', encoding='utf-8') as f:
    cust = {c['id']: c for c in csv.DictReader(f)}

year_prefix = re.compile(r'^1[012]\d')
non_year = [o for o in orders if o.get('legacy_code') and not year_prefix.match(o['legacy_code'])]

# 把每個 prefix 分類
def prefix_of(code):
    if not code: return ''
    # 中文整字
    if re.match(r'^[一-鿿]', code):
        m = re.match(r'^([一-鿿]+)', code)
        return ('中文', m.group(1))
    # 字母前綴
    m = re.match(r'^([A-Za-z]+)', code)
    if m:
        return ('字母', m.group(1).upper())
    # 數字+橫線（非年份）
    if re.match(r'^\d+-', code):
        return ('數字-', code.split('-')[0])
    return ('其他', code[:3])

groups = defaultdict(list)
for o in non_year:
    kind, key = prefix_of(o['legacy_code'])
    groups[(kind, key)].append(o)

# 按筆數排序
sorted_groups = sorted(groups.items(), key=lambda kv: -len(kv[1]))

print('=== 各種非年份開頭格式（依筆數排序）===\n')
print(f"{'類型':<5} {'前綴':<10} {'筆數':<6} {'最近日期':<12} {'例編號':<14} {'例客戶':<10}")
print('-'*70)

for i, ((kind, key), os_) in enumerate(sorted_groups[:25]):
    # 取最近一筆作 sample
    o = max(os_, key=lambda x: x['service_at'])
    name = cust.get(o['customer_id'], {}).get('name', '')
    print(f"{kind:<5} {key:<10} {len(os_):<6} {o['service_at'][:10]:<12} {o['legacy_code']:<14} {name}")
