import csv
with open('out/clean/orders.csv', encoding='utf-8') as f:
    rows = list(csv.DictReader(f))
with_code = [r for r in rows if r.get('legacy_code')]
print(f'clean/orders.csv 共 {len(rows)} 筆')
print(f'有 legacy_code: {len(with_code)} 筆 ({len(with_code)/len(rows)*100:.1f}%)')
print(f'\n樣本：')
for r in with_code[:8]:
    print(f"  {r['order_code']:<22} → legacy_code = {r['legacy_code']}")
