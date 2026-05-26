"""統計 legacy_code 的格式分布，看哪些是年份開頭、哪些不是"""
import csv, re
from collections import Counter

with open('out/clean/orders.csv', encoding='utf-8') as f:
    rows = list(csv.DictReader(f))

codes = [r['legacy_code'] for r in rows if r.get('legacy_code')]
print(f'總筆數: {len(rows)}')
print(f'有 legacy_code: {len(codes)}\n')

# 民國年開頭 (3 位數 1xx)
year_prefix = re.compile(r'^1[012]\d')   # 100-129 涵蓋民國年
year_codes = [c for c in codes if year_prefix.match(c)]
non_year = [c for c in codes if not year_prefix.match(c)]

print(f'=== 民國年開頭（1xx）：{len(year_codes)} 筆 ===')
# 列前幾個 prefix 統計
prefix_count = Counter(c[:4] for c in year_codes)
for p, n in prefix_count.most_common():
    print(f'  {p}-*  : {n} 筆')

print(f'\n=== 非年份開頭：{len(non_year)} 筆 ===')
# 看 non_year 的開頭字母分布
non_prefix = Counter()
for c in non_year:
    m = re.match(r'^([A-Za-z一-鿿]+|\d+)', c)
    if m:
        non_prefix[m.group(1)] += 1
    else:
        non_prefix['(其他)'] += 1
for p, n in non_prefix.most_common(20):
    sample = next((c for c in non_year if c.startswith(p)), '')
    print(f'  {p}*  : {n} 筆  例: {sample}')

# 進一步看 non_year 的完整樣本
print(f'\n=== 非年份開頭 20 個樣本 ===')
for c in non_year[:20]:
    print(f'  {c}')
