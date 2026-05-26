"""產生員工登入卡 HTML，QR Code 直接 base64 嵌進 HTML，離線可用"""
import qrcode
import io
import base64

BASE_URL = "https://jingxin-laundry-cms.vercel.app"

def qr_b64(text):
    """產生 QR PNG 並回傳 base64 data URI"""
    qr = qrcode.QRCode(version=None, box_size=10, border=2)
    qr.add_data(text)
    qr.make(fit=True)
    img = qr.make_image(fill_color="black", back_color="white")
    buf = io.BytesIO()
    img.save(buf, format="PNG")
    return "data:image/png;base64," + base64.b64encode(buf.getvalue()).decode()

# 老闆娘 + 5 位師傅
OWNER = {
    "name": "老闆娘",
    "role": "owner",
    "account": "ting201314",
    "password": "ting751212",
    "url": f"{BASE_URL}/manager",
    "desc": "自動開啟「老闆娘 PWA」<br>可看一周排案／待派案／今日回繳",
}

TECHS = [
    {"name": "A — 陳昶志", "account": "201314", "password": "010507230"},
    {"name": "C — 徐祥瑋", "account": "5785",   "password": "011202210"},
    {"name": "D — 羅允辰", "account": "5357",   "password": "011302190"},
    {"name": "E — 葉翰霖", "account": "1227",   "password": "011311280"},
    {"name": "F — 楊仕丞", "account": "6398",   "password": "011504010"},
]

def owner_card_html(p):
    qr = qr_b64(p["url"])
    return f"""
    <div class="card owner">
      <h2 class="card-title">{p['name']}</h2>
      <span class="card-role">owner</span>
      <div class="qr-box">
        <img class="qr-img" src="{qr}" alt="QR">
        <div class="qr-hint">
          <strong>手機掃這個</strong>
          {p['desc']}
        </div>
      </div>
      <div class="creds">
        <div class="creds-row"><span class="creds-key">帳號</span><span class="creds-val">{p['account']}</span></div>
        <div class="creds-row"><span class="creds-key">密碼</span><span class="creds-val">{p['password']}</span></div>
      </div>
      <a class="desktop-link" href="{BASE_URL}/login" target="_blank">🖥️ 電腦版（完整後台）→</a>
    </div>"""

def tech_card_html(p):
    qr = qr_b64(f"{BASE_URL}/staff")
    return f"""
    <div class="card">
      <h2 class="card-title">{p['name']}</h2>
      <span class="card-role">technician</span>
      <div class="qr-box">
        <img class="qr-img" src="{qr}" alt="QR">
        <div class="qr-hint">
          <strong>掃完開啟師傅 PWA</strong>
          看今日任務、改服務時間、回繳金額
        </div>
      </div>
      <div class="creds">
        <div class="creds-row"><span class="creds-key">帳號</span><span class="creds-val">{p['account']}</span></div>
        <div class="creds-row"><span class="creds-key">密碼</span><span class="creds-val">{p['password']}</span></div>
      </div>
    </div>"""

owner_html = owner_card_html(OWNER)
techs_html = "\n".join(tech_card_html(t) for t in TECHS)

HTML = f"""<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>淨新清潔工坊 — 員工登入卡</title>
<style>
  :root {{
    --brand: #1e7a5b; --brand-light: #d4f1e3;
    --ink: #0a0a0a; --muted: #6b7280;
    --line: #e5e7eb; --bg: #fafafa;
  }}
  * {{ box-sizing: border-box; }}
  body {{
    margin: 0;
    font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", "PingFang TC", "Microsoft JhengHei", sans-serif;
    background: var(--bg); color: var(--ink);
    padding: 24px 16px; line-height: 1.5;
  }}
  .container {{ max-width: 880px; margin: 0 auto; }}
  header {{
    text-align: center; margin-bottom: 24px;
    padding-bottom: 20px; border-bottom: 2px solid var(--line);
  }}
  h1 {{ margin: 0 0 8px; font-size: 24px; }}
  .subtitle {{ margin: 0; color: var(--muted); font-size: 14px; }}
  .warning {{
    background: #fef3c7; border: 1px solid #fde68a; color: #92400e;
    padding: 12px 16px; border-radius: 10px; margin: 16px 0 24px; font-size: 14px;
  }}
  .card-grid {{ display: grid; gap: 16px; }}
  @media (min-width: 640px) {{ .card-grid {{ grid-template-columns: 1fr 1fr; }} }}
  .card {{
    background: white; border: 1px solid var(--line);
    border-radius: 14px; padding: 20px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  }}
  .card.owner {{ border-color: var(--brand); background: var(--brand-light); }}
  .card-title {{ margin: 0 0 4px; font-size: 18px; font-weight: 700; }}
  .card-role {{
    display: inline-block; font-size: 12px;
    padding: 2px 8px; border-radius: 999px;
    background: var(--bg); color: var(--muted); margin-bottom: 12px;
  }}
  .card.owner .card-role {{ background: var(--brand); color: white; }}
  .qr-box {{ display: flex; align-items: center; gap: 16px; margin-bottom: 12px; }}
  .qr-img {{
    width: 140px; height: 140px; flex-shrink: 0;
    background: white; padding: 6px;
    border-radius: 8px; border: 1px solid var(--line);
    display: block;
  }}
  .qr-hint {{ font-size: 12px; color: var(--muted); line-height: 1.6; }}
  .qr-hint strong {{ color: var(--ink); display: block; margin-bottom: 4px; font-size: 13px; }}
  .creds {{
    background: var(--bg); border-radius: 8px; padding: 12px;
    font-family: ui-monospace, SFMono-Regular, Menlo, monospace;
    font-size: 14px; margin-bottom: 8px;
  }}
  .creds-row {{ display: flex; gap: 8px; padding: 2px 0; }}
  .creds-key {{ color: var(--muted); width: 50px; flex-shrink: 0; }}
  .creds-val {{ color: var(--ink); font-weight: 600; word-break: break-all; }}
  .desktop-link {{
    display: inline-flex; align-items: center; gap: 6px;
    color: var(--brand); text-decoration: none;
    font-size: 13px; font-weight: 500;
    padding: 6px 10px; border: 1px solid var(--brand); border-radius: 6px;
  }}
  .desktop-link:hover {{ background: var(--brand-light); }}
  .section-title {{
    margin: 32px 0 12px; font-size: 16px; font-weight: 700;
    color: var(--muted); padding-left: 4px;
  }}
  footer {{
    text-align: center; margin-top: 40px;
    padding-top: 20px; border-top: 1px solid var(--line);
    color: var(--muted); font-size: 12px;
  }}
  .guide {{
    background: white; border: 1px solid var(--line);
    border-radius: 14px; padding: 4px 24px 16px;
    box-shadow: 0 1px 2px rgba(0,0,0,0.04);
  }}
  .guide-section {{
    padding: 12px 0; border-bottom: 1px solid var(--line);
  }}
  .guide-section:last-child {{ border-bottom: none; }}
  .guide-section h3 {{
    margin: 0 0 8px; font-size: 15px; font-weight: 700; color: var(--brand);
  }}
  .guide-section ul {{
    margin: 0; padding-left: 22px; font-size: 13.5px;
    color: var(--ink); line-height: 1.75;
  }}
  .guide-section li {{ margin-bottom: 2px; }}
  .guide-section li b {{ color: #1e7a5b; }}
  .guide-section code {{
    background: #f3f4f6; padding: 1px 5px; border-radius: 4px;
    font-size: 12px; font-family: ui-monospace, SFMono-Regular, monospace;
  }}
  .guide-section kbd {{
    background: #e5e7eb; padding: 1px 6px; border-radius: 4px;
    font-size: 11px; font-family: ui-monospace, SFMono-Regular, monospace;
    border: 1px solid #d1d5db;
  }}
  @media print {{
    body {{ background: white; }}
    .card, .guide {{ box-shadow: none; }}
    .guide-section {{ page-break-inside: avoid; }}
  }}
</style>
</head>
<body>
<div class="container">
  <header>
    <h1>淨新清潔工坊 — 員工登入卡</h1>
    <p class="subtitle">手機請掃 QR Code（自動進入 PWA 行動版）／電腦請點藍色連結</p>
  </header>

  <div class="warning">
    ⚠ 此頁面含所有員工帳號密碼，請勿轉發給外人。
  </div>

  <p class="section-title">👤 老闆娘</p>
  <div class="card-grid">{owner_html}
  </div>

  <p class="section-title">🔧 師傅（手機 PWA）</p>
  <div class="card-grid">{techs_html}
  </div>

  <p class="section-title">📖 使用說明（給老闆娘）</p>
  <div class="guide">

    <div class="guide-section">
      <h3>1. 怎麼開始用？</h3>
      <ul>
        <li><b>手機</b>：掃自己的 QR Code → 自動進入「老闆娘 PWA」（手機版專屬介面：一周排案 / 待派案 / 今日回繳 / 主選單）</li>
        <li><b>電腦</b>：點上面的「🖥️ 電腦版」連結 → 完整後台（客戶管理、報表、設定等）</li>
        <li><b>師傅</b>：把對應的 QR Code 用 LINE/簡訊個別傳給師傅，他們掃完就進入師傅 PWA</li>
      </ul>
    </div>

    <div class="guide-section">
      <h3>2. 接到電話要建單時</h3>
      <ul>
        <li><b>手機快速搜尋</b>：點右上「🔍 搜尋」→ 輸入客戶姓名/電話/地址 → 找到客戶 → 點「📝 建單」直接帶資料進去</li>
        <li><b>電腦快速搜尋</b>：任意頁面按 <kbd>Ctrl + K</kbd> 跳出搜尋框</li>
        <li><b>搜尋範圍</b>：客戶姓名、主電話、副電話、地址、舊清洗編號（如 <code>114C-C089</code>）、保固單編號、機器編碼</li>
        <li><b>已知有師傅可接</b>：建單時直接選師傅 + 填預約時間 → 訂單會直接進「已排案」，不用再到月曆拖曳</li>
        <li><b>還不確定派誰</b>：建單時師傅留空 → 訂單進「待派工」，之後到月曆把它拖到對應師傅的時段</li>
      </ul>
    </div>

    <div class="guide-section">
      <h3>3. 服務項目與金額</h3>
      <ul>
        <li>建單時只看到 <b>8 個基本價</b>按鈕：直立式 1800 / 雙槽 1300 / 滾筒 4000 / 沙發 1800 / 床墊除蟎 1300 / 床墊清洗 1800 / 分離冷氣 2500 / 吊隱冷氣 3200</li>
        <li>實際機型品牌容量、加減項（拆解費/移機費等）由<b>師傅現場補</b>，系統會自動重算總額</li>
        <li>要改基本價或新增項目 → 進「設定 → 服務項目」，勾「⭐ 建單基本」決定哪幾項出現在建單頁</li>
      </ul>
    </div>

    <div class="guide-section">
      <h3>4. 看訂單 / 找歷史</h3>
      <ul>
        <li>「訂單管理」頁預設只顯示<b>近 3 個月</b>的訂單（避免 lag）。要看更舊的→點頂部「近 6 個月 / 今年 / 全部時間」</li>
        <li>客戶回電報舊編號（如 <code>113A-C103</code>） → 直接全域搜尋找得到該筆訂單</li>
        <li>師傅 PWA 每張訂單顯示「📋 保固單編號」黃色框（如 <code>20260527-001-1</code>） → 給師傅<b>照抄</b>到保固單，不用憑記憶亂編</li>
      </ul>
    </div>

    <div class="guide-section">
      <h3>5. 舊客戶資料 (匯入 10,891 位)</h3>
      <ul>
        <li>2016~2025 的舊 Excel 已整理進系統，編號格式 <code>OLD-XXXXX</code></li>
        <li>有舊清洗編號的訂單（114C-C089 等）保留可查，其他英文字母前綴的舊編碼已清除</li>
        <li>還有 <b>126 位「⚠ 待核對」</b>客戶未匯入（電話/地址可疑），給老闆娘的 <code>customers_review.xlsx</code> 逐筆勾完後可批次補匯</li>
      </ul>
    </div>

    <div class="guide-section">
      <h3>6. 客戶編號</h3>
      <ul>
        <li>新建客戶時系統<b>自動帶下個流水</b>（C00001、C00002...），老闆娘想用自訂編號（VIP-001、STAFF-001）直接覆寫即可</li>
        <li>不會跟舊 OLD-XXXXX 衝突</li>
      </ul>
    </div>

    <div class="guide-section">
      <h3>7. 安全提醒</h3>
      <ul>
        <li>⚠ 此頁面內容含所有員工密碼，<b>不要轉發給外人</b>（包括家人朋友）</li>
        <li>師傅 QR Code 個別傳給對應師傅就好，不要群組分享</li>
        <li>若懷疑帳號被盜 → 立刻通知 RC 重設密碼</li>
        <li>系統定期備份到 Supabase 雲端，不會掉資料</li>
      </ul>
    </div>

    <div class="guide-section">
      <h3>8. 出問題 / 想加新功能</h3>
      <ul>
        <li>用 LINE 聯絡 <b>RC（仁格數位科技 / Ren Studio）</b></li>
        <li>Email：ren.studio.dev@gmail.com｜電話：0976-858-794</li>
        <li>小 bug、要改文字、要加功能都歡迎隨時提</li>
      </ul>
    </div>

  </div>

  <footer>
    淨新清潔工坊 CMS · Ren Studio · 2026
  </footer>
</div>
</body>
</html>
"""

with open("login-card.html", "w", encoding="utf-8") as f:
    f.write(HTML)

print(f"✅ 寫入 login-card.html ({len(HTML):,} bytes)")
print(f"   含 6 個 base64 QR Code，完全離線可用")
