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
