"""
Step 2: 從 rows.csv 建出 CMS 可匯入的資料表。

輸出（out/）：
  customers.csv          ─ 有電話、可進主檔
  customer_addresses.csv ─ 每個客戶的地址
  machines.csv           ─ 每個客戶的機器
  orders.csv             ─ 訂單主檔
  order_items.csv        ─ 訂單明細（多廠牌已拆）
  manual_review.xlsx     ─ 無電話訂單（給老闆娘人工核對）
  build_report.txt       ─ 統計報告

去重策略：
  - 客戶 key = 正規化電話（多支取第一支）
  - 同電話 → 同客戶（id 不變，name 取最早出現的非空）
  - 同電話多地址 → 都存進 customer_addresses，第一個 default
"""
from __future__ import annotations
import csv
import re
import uuid
from collections import defaultdict
from datetime import datetime
from pathlib import Path

from openpyxl import Workbook


OUT_DIR = Path(__file__).parent / "out"
ROWS_CSV = OUT_DIR / "rows.csv"


# ---------------------------------------------------------------------------
# 縣市/鄉鎮市區（與 app/src/lib/taiwan-regions.ts 同步）
# ---------------------------------------------------------------------------
COUNTIES = ["台中市", "彰化縣", "南投縣", "雲林縣", "嘉義縣", "嘉義市",
            "苗栗縣", "新北市", "台北市", "桃園市", "新竹縣", "新竹市",
            "高雄市", "台南市", "台東縣", "屏東縣", "宜蘭縣", "花蓮縣",
            "基隆市", "澎湖縣", "金門縣", "連江縣"]
# 別名（簡寫 → 正式名）
COUNTY_ALIAS = {
    "臺中市": "台中市", "臺北市": "台北市", "臺南市": "台南市", "臺東縣": "台東縣",
    # 不能加「彰化→彰化縣」這種短形，會把「彰化市」誤改成「彰化縣市」
}
DISTRICTS = [
    # 台中
    "中區", "東區", "西區", "南區", "北區", "西屯區", "南屯區", "北屯區",
    "豐原區", "東勢區", "大甲區", "清水區", "沙鹿區", "梧棲區", "后里區",
    "神岡區", "潭子區", "大雅區", "新社區", "石岡區", "外埔區", "大安區",
    "烏日區", "大肚區", "龍井區", "霧峰區", "太平區", "大里區", "和平區",
    # 彰化
    "彰化市", "鹿港鎮", "和美鎮", "員林市", "溪湖鎮", "田中鎮", "北斗鎮",
    "二林鎮", "線西鄉", "伸港鄉", "福興鄉", "秀水鄉", "花壇鄉", "芬園鄉",
    "大村鄉", "埔鹽鄉", "埔心鄉", "永靖鄉", "社頭鄉", "二水鄉", "田尾鄉",
    "埤頭鄉", "芳苑鄉", "大城鄉", "竹塘鄉", "溪州鄉",
    # 南投
    "南投市", "埔里鎮", "草屯鎮", "竹山鎮", "集集鎮", "名間鄉", "鹿谷鄉",
    "中寮鄉", "魚池鄉", "國姓鄉", "水里鄉", "信義鄉", "仁愛鄉",
    # 雲林
    "斗六市", "斗南鎮", "虎尾鎮", "西螺鎮", "土庫鎮", "北港鎮", "古坑鄉",
    "大埤鄉", "莿桐鄉", "林內鄉", "二崙鄉", "崙背鄉", "麥寮鄉", "東勢鄉",
    "褒忠鄉", "臺西鄉", "元長鄉", "四湖鄉", "口湖鄉", "水林鄉",
    "員林鎮",  # 已升格為市，但舊資料可能寫鎮
]


DIST_TO_COUNTY = {
    "彰化市": "彰化縣", "員林市": "彰化縣", "鹿港鎮": "彰化縣",
    "和美鎮": "彰化縣", "溪湖鎮": "彰化縣", "田中鎮": "彰化縣",
    "北斗鎮": "彰化縣", "二林鎮": "彰化縣",
    "南投市": "南投縣", "草屯鎮": "南投縣", "竹山鎮": "南投縣",
    "斗六市": "雲林縣", "虎尾鎮": "雲林縣", "斗南鎮": "雲林縣",
}

# 抓「XX(市|區|鎮|鄉)」當作 district fallback
DIST_PATTERN = re.compile(r"^([一-鿿]{1,4}(?:市|區|鎮|鄉))")


def parse_address(full: str) -> tuple[str, str, str]:
    """從完整地址抽出 (county, district, address_rest)。

    解析失敗就保留原文：
    - 完全解不到：county="未分類", district="未分類", address=full（保留全文）
    - 只解到 county：district="未分類", address=full（保留全文，UI 不會少資訊）
    - county+district 都解到：address=去前綴後的剩餘
    """
    if not full:
        return ("", "", "")
    s = full.strip()
    original = s
    # 別名正規化
    for alias, official in COUNTY_ALIAS.items():
        if s.startswith(alias):
            s = official + s[len(alias):]
            original = s
            break

    county = ""
    for c in COUNTIES:
        if s.startswith(c):
            county = c
            s = s[len(c):].strip()
            break

    district = ""
    for d in DISTRICTS:
        if s.startswith(d):
            district = d
            s = s[len(d):].strip()
            break

    # district fallback：抓「XX市/區/鎮/鄉」
    if not district:
        m = DIST_PATTERN.match(s)
        if m:
            district = m.group(1)
            s = s[len(district):].strip()

    # county fallback：用 district 推
    if not county and district:
        county = DIST_TO_COUNTY.get(district, "")

    # 收尾：解不到的欄位用「未分類」，且 address 一律保留還原得到的剩餘字串
    # 但如果連 county 都沒抓到，address 就用原文（避免顯示空地址）
    if not county and not district:
        return ("未分類", "未分類", original)
    if county and not district:
        # 保留 county 給索引/篩選，但 address 用 county 後的剩餘（不是「未分類XX」）
        return (county, "未分類", s or original)
    return (county or "未分類", district, s or original)


# ---------------------------------------------------------------------------
# 廠牌/品項解析
# ---------------------------------------------------------------------------
def parse_amounts(s: str) -> list[tuple[float, int]]:
    if not s:
        return []
    # 拆 + ＋ 換行 、 , — 多筆金額常用換行分隔
    parts = re.split(r"\s*[+＋、,]\s*|\s*[\n\r]+\s*", s.strip())
    out = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        m = re.match(r"^(\d+(?:\.\d+)?)\s*[*×xX]\s*(\d+)$", p)
        if m:
            out.append((float(m.group(1)), int(m.group(2))))
            continue
        n = re.sub(r"[^\d.]", "", p)
        if n:
            try:
                out.append((float(n), 1))
            except ValueError:
                pass
    return out


def parse_brands(s: str) -> list[str]:
    if not s:
        return []
    parts = re.split(r"\s*[+＋、,]\s*", s.strip())
    out = []
    for p in parts:
        p = p.strip()
        if not p:
            continue
        m = re.match(r"^(.+?)\s*[*×xX]\s*(\d+)$", p)
        if m:
            out.extend([m.group(1).strip()] * int(m.group(2)))
        else:
            out.append(p)
    return out


def detect_machine_type(brand: str, item: str) -> str:
    """根據廠牌/項目字串推測 machine_type（CMS enum）。"""
    s = (brand or "") + " " + (item or "")
    s_lower = s.lower()
    if any(k in s for k in ["床墊", "床"]):
        return "mattress"
    if "沙發" in s:
        return "sofa"
    if "冷氣" in s or "冷" in s or "ac" in s_lower:
        return "air_conditioner"
    if "滾筒" in s or "滾" in s or "drum" in s_lower or "twin" in s_lower or "tower" in s_lower:
        return "washing_machine"
    return "washing_machine"  # 預設


def detect_service_code(brand: str, item: str) -> str:
    """對應到「舊資料-XX」通用 service_item 的 code。"""
    s = (brand or "") + " " + (item or "")
    s_lower = s.lower()
    if "床墊" in s or "床" in s:
        return "OLD-MATTRESS"
    if "沙發" in s:
        return "OLD-SOFA"
    if "冷氣" in s or "冷" in s:
        return "OLD-AC"
    if "滾" in s or "drum" in s_lower or "twin" in s_lower or "tower" in s_lower:
        return "OLD-WASHER-DRUM"
    return "OLD-WASHER-VERTICAL"


def normalize_brand_name(b: str) -> str:
    """把混亂的品牌字串簡化（去型號、保留主品牌）。"""
    if not b:
        return ""
    s = b.strip()
    # 去括號內容
    s = re.sub(r"[（(].*?[）)]", "", s)
    # 取第一段字（品牌名通常在前面）
    s = re.split(r"[\s\n]", s)[0]
    return s.strip()


# ---------------------------------------------------------------------------
# 主流程
# ---------------------------------------------------------------------------
def main():
    print("=== Step 2: Build ===\n")
    print("讀入 rows.csv...")
    rows = []
    with open(ROWS_CSV, "r", encoding="utf-8-sig", newline="") as f:
        for r in csv.DictReader(f):
            rows.append(r)
    print(f"  {len(rows)} rows\n")

    # ---- 分桶：有電話 vs 無電話 ----
    rows_with_phone = []
    rows_no_phone = []
    for r in rows:
        if r["phones"]:
            rows_with_phone.append(r)
        else:
            rows_no_phone.append(r)
    print(f"有電話：{len(rows_with_phone)}")
    print(f"無電話：{len(rows_no_phone)}（另存 manual_review.xlsx）\n")

    # ---- 客戶去重（用第一支電話） ----
    print("客戶去重...")
    cust_by_phone: dict[str, dict] = {}
    # phone → list of row indices
    phone_to_rows: dict[str, list[int]] = defaultdict(list)
    for i, r in enumerate(rows_with_phone):
        phones = r["phones"].split("|")
        primary_phone = phones[0]
        phone_to_rows[primary_phone].append(i)

    # 也把副電話視為同人（如果副電話本身也是主鍵）
    # 例：A 列 phones="0911|056xx", B 列 phones="056xx"
    # 用 union-find 結構
    parent: dict[str, str] = {}
    def find(x):
        while parent.get(x, x) != x:
            parent[x] = parent.get(parent.get(x, x), parent.get(x, x))
            x = parent[x]
        return x
    def union(a, b):
        ra, rb = find(a), find(b)
        if ra != rb:
            parent[ra] = rb

    # 對所有電話建 parent（包含只當副電話的）
    for r in rows_with_phone:
        for p in r["phones"].split("|"):
            if p:
                parent.setdefault(p, p)
    # 每筆 row 內的所有電話都互相 union（不管是主還副）
    # 這樣「A 主+B 副」「C 主+B 副」也會合併到同一個 root
    for r in rows_with_phone:
        phones = [p for p in r["phones"].split("|") if p]
        if len(phones) > 1:
            base = phones[0]
            for p in phones[1:]:
                union(base, p)

    # 用 find(primary) 當作 customer key
    cust_groups: dict[str, list[dict]] = defaultdict(list)
    for r in rows_with_phone:
        primary = r["phones"].split("|")[0]
        key = find(primary)
        cust_groups[key].append(r)

    print(f"  {len(cust_groups)} 個唯一客戶\n")

    # ---- 產出客戶/地址/機器/訂單 ----
    customers = []      # rows for customers.csv
    cust_phones = []    # rows for customer_phones.csv (多支電話)
    addresses = []      # rows for customer_addresses.csv
    machines = []       # rows for machines.csv
    orders = []         # rows for orders.csv
    order_items = []    # rows for order_items.csv

    # 機器去重：同客戶 (machine_type, brand) 只算一台
    cust_machine_map: dict[tuple[str, str, str], str] = {}  # (cust_id, type, brand) → machine_id

    # 訂單編號計數：YYYYMMDD → seq
    order_seq: dict[str, int] = defaultdict(int)

    print("產出客戶/地址/機器/訂單...")
    cust_counter = 0
    for key in sorted(cust_groups.keys()):
        group = cust_groups[key]
        cust_counter += 1
        cust_id = str(uuid.uuid4())
        cust_code = f"OLD-{cust_counter:05d}"

        # 姓名：取最早出現的非空
        name = ""
        for r in group:
            if r["name"]:
                name = r["name"]
                break
        if not name:
            name = "（舊資料-無姓名）"

        # 電話：聯集所有電話（保持出現順序）
        all_phones = []
        for r in group:
            for p in r["phones"].split("|"):
                if p and p not in all_phones:
                    all_phones.append(p)
        primary_phone = all_phones[0]

        # joined_at：最早的日期
        dates = sorted(r["date"] for r in group if r["date"])
        joined_at = dates[0] if dates else ""

        # 來源處：第一個非空的
        source_text = next((r["source"] for r in group if r["source"]), "")

        # note：只放原始來源處（副電話改放 customer_phones 子表）
        note = f"舊資料來源: {source_text}" if source_text else ""

        customers.append({
            "id": cust_id,
            "code": cust_code,
            "name": name,
            "phone": primary_phone,
            "joined_at": joined_at,
            "note": note,
        })

        # 多支電話：全部寫進 customer_phones
        for i, p in enumerate(all_phones):
            cust_phones.append({
                "id": str(uuid.uuid4()),
                "customer_id": cust_id,
                "phone": p,
                "label": "" if i == 0 else "副電話",
                "is_primary": "true" if i == 0 else "false",
                "sort_order": i,
            })

        # 地址：用「(county, district, address)」三元組去重
        # 不能用 addr_raw 當 key — 同客戶在不同訂單可能寫
        # 「彰化縣彰化市XX路」vs「彰化市XX路」(缺縣)，parse 後相同但 raw 不同
        addr_ids: dict[str, str] = {}  # addr_raw → id (for lookup)
        addr_norm_to_id: dict[tuple, str] = {}  # (county, district, rest) → id (真正去重)
        is_first = True
        for r in group:
            for addr_raw in r["addresses"].split("|"):
                addr_raw = addr_raw.strip()
                if not addr_raw:
                    continue
                county, district, rest = parse_address(addr_raw)
                norm_key = (county, district, rest.strip())
                # 已存在 → 同地址，addr_ids 也指向相同 id
                if norm_key in addr_norm_to_id:
                    addr_ids[addr_raw] = addr_norm_to_id[norm_key]
                    continue
                aid = str(uuid.uuid4())
                addr_ids[addr_raw] = aid
                addr_norm_to_id[norm_key] = aid
                addresses.append({
                    "id": aid,
                    "customer_id": cust_id,
                    "county": county,
                    "district": district,
                    "address": rest,
                    "label": "",
                    "is_default": "true" if is_first else "false",
                })
                is_first = False

        # 若客戶完全沒有地址，補一個空地址（schema 要求至少一個）
        if not addr_ids:
            aid = str(uuid.uuid4())
            addresses.append({
                "id": aid,
                "customer_id": cust_id,
                "county": "未分類",
                "district": "未分類",
                "address": "（舊資料-無地址）",
                "label": "",
                "is_default": "true",
            })
            addr_ids["_default"] = aid

        default_addr_id = list(addr_ids.values())[0]

        # 訂單 + 明細
        for r in group:
            if not r["date"]:
                # 無日期跳過（建議放 manual_review，但先簡化跳過）
                continue
            date_str = r["date"]
            yyyymmdd = date_str.replace("-", "")
            order_seq[yyyymmdd] += 1
            order_code = f"OLD-{yyyymmdd}-{order_seq[yyyymmdd]:03d}"
            order_id = str(uuid.uuid4())

            # 該列的地址（用第一個有效的）
            order_addr_id = default_addr_id
            for addr_raw in r["addresses"].split("|"):
                addr_raw = addr_raw.strip()
                if addr_raw and addr_raw in addr_ids:
                    order_addr_id = addr_ids[addr_raw]
                    break

            # 拆品牌+金額成多 items
            brands = parse_brands(r["brand_raw"]) or [""]
            amts = parse_amounts(r["amount_raw"])
            item_text = r["item_raw"]

            # 配對策略
            paired = []
            if len(amts) == 1 and amts[0][1] > 1 and len(brands) == 1:
                # 單品牌 + 「1600*2」型：拆成 N 筆相同 brand
                price, qty = amts[0]
                for _ in range(qty):
                    paired.append((brands[0], price))
            elif len(brands) == len(amts) and len(brands) > 0:
                for b, (p, q) in zip(brands, amts):
                    for _ in range(q):
                        paired.append((b, p))
            elif len(brands) > 0 and len(amts) > 0:
                # 數量不對等：以 brands 為主，平均單價
                total = sum(p * q for p, q in amts)
                each = total / len(brands)
                for b in brands:
                    paired.append((b, each))
            elif len(brands) > 0 and not amts:
                for b in brands:
                    paired.append((b, 0))
            elif amts and not brands:
                for p, q in amts:
                    for _ in range(q):
                        paired.append(("", p))
            else:
                # 都空：1 筆 0 元（保留訂單存在）
                paired.append(("", 0))

            # 算訂單總額
            subtotal = sum(p for _, p in paired)
            total = subtotal

            # 實收金額（legacy csv 有，覆蓋計算出的 total）
            actual = r.get("actual_amount", "")
            try:
                actual_f = float(actual) if actual else 0
            except ValueError:
                actual_f = 0
            final_total = actual_f if actual_f > 0 else total

            orders.append({
                "id": order_id,
                "order_code": order_code,
                "customer_id": cust_id,
                "address_id": order_addr_id,
                "scheduled_at": date_str + "T09:00:00+08:00",
                "service_at": date_str + "T10:00:00+08:00",
                "status": "done",
                "payment_method": r["payment"] or "cash",
                "subtotal": f"{subtotal:.2f}",
                "adjustments_total": f"{(final_total - subtotal):.2f}",
                "total": f"{final_total:.2f}",
                "source": r["source"],
                "note": f"匯入自 {r['source_file']} {r['sheet']} row {r['row_no']}"
                        + (f" | 服務人員: {r.get('staff_name', '')}" if r.get("staff_name") else ""),
                "legacy_code": r.get("legacy_code", ""),
                "staff_name_raw": r.get("staff_name", ""),  # 暫存，import.mjs 時對應 technician_id
            })

            # 產 order_items + 機器
            for brand, price in paired:
                mtype = detect_machine_type(brand, item_text)
                svc_code = detect_service_code(brand, item_text)
                brand_norm = normalize_brand_name(brand)

                # 機器去重：同 (customer, type, brand_norm)
                mkey = (cust_id, mtype, brand_norm)
                if mkey in cust_machine_map:
                    mid = cust_machine_map[mkey]
                else:
                    mid = str(uuid.uuid4())
                    cust_machine_map[mkey] = mid
                    machines.append({
                        "id": mid,
                        "customer_id": cust_id,
                        "address_id": order_addr_id,
                        "type": mtype,
                        "brand": brand_norm,
                        "model": "",
                        "sub_type": "",
                        "note": "",
                    })

                order_items.append({
                    "id": str(uuid.uuid4()),
                    "order_id": order_id,
                    "machine_id": mid,
                    "service_code": svc_code,  # build script 之後 mapping 成 service_item_id
                    "technician_id": "",
                    "quantity": 1,
                    "unit_price": f"{price:.2f}",
                    "subtotal": f"{price:.2f}",
                    "tag": "",
                    "note": f"原始廠牌: {brand}" if brand else "",
                })

    # ---- 寫出 CSV ----
    def write_csv(name, rows_, fields):
        path = OUT_DIR / name
        with open(path, "w", encoding="utf-8-sig", newline="") as f:
            w = csv.DictWriter(f, fieldnames=fields)
            w.writeheader()
            for r in rows_:
                w.writerow(r)
        print(f"  寫出 {name}: {len(rows_)} rows")

    print("\n寫出 CSV...")
    write_csv("customers.csv", customers,
              ["id", "code", "name", "phone", "joined_at", "note"])
    write_csv("customer_phones.csv", cust_phones,
              ["id", "customer_id", "phone", "label", "is_primary", "sort_order"])
    write_csv("customer_addresses.csv", addresses,
              ["id", "customer_id", "county", "district", "address", "label", "is_default"])
    write_csv("machines.csv", machines,
              ["id", "customer_id", "address_id", "type", "brand", "model", "sub_type", "note"])
    write_csv("orders.csv", orders,
              ["id", "order_code", "customer_id", "address_id", "scheduled_at",
               "service_at", "status", "payment_method", "subtotal",
               "adjustments_total", "total", "source", "note",
               "legacy_code", "staff_name_raw"])
    write_csv("order_items.csv", order_items,
              ["id", "order_id", "machine_id", "service_code", "technician_id",
               "quantity", "unit_price", "subtotal", "tag", "note"])

    # ---- 無電話訂單 → manual_review.xlsx ----
    print("\n寫 manual_review.xlsx...")
    wb = Workbook()
    sh = wb.active
    sh.title = "無電話訂單"
    headers = ["原始檔", "工作表", "row", "日期", "姓名", "地址",
               "廠牌", "金額", "項目", "付款方式", "來源處", "機器編號"]
    sh.append(headers)
    for r in rows_no_phone:
        sh.append([
            r["source_file"], r["sheet"], r["row_no"], r["date"], r["name"],
            r["addresses"], r["brand_raw"], r["amount_raw"], r["item_raw"],
            r["payment"], r["source"], r["machine_id"],
        ])
    # 凍結首列
    sh.freeze_panes = "A2"
    # 自動欄寬
    for col_idx, h in enumerate(headers, start=1):
        sh.column_dimensions[sh.cell(1, col_idx).column_letter].width = max(12, len(h) * 2)
    wb.save(str(OUT_DIR / "manual_review.xlsx"))
    print(f"  manual_review.xlsx: {len(rows_no_phone)} rows")

    # ---- 報告 ----
    no_date_count = sum(1 for r in rows_with_phone if not r["date"])
    report = f"""舊資料遷移 - Build 報告
=================================
產出時間: {datetime.now().isoformat(timespec='seconds')}

來源:
  rows.csv: {len(rows)} 列

分桶:
  有電話: {len(rows_with_phone)} 列
  無電話: {len(rows_no_phone)} 列 → manual_review.xlsx

匯入主檔:
  customers:           {len(customers)}
  customer_phones:     {len(cust_phones)}
  customer_addresses:  {len(addresses)}
  machines:            {len(machines)}
  orders:              {len(orders)}
  order_items:         {len(order_items)}

警告:
  有電話但無日期（已跳過）: {no_date_count}
"""
    (OUT_DIR / "build_report.txt").write_text(report, encoding="utf-8")
    print("\n" + report)


if __name__ == "__main__":
    main()
