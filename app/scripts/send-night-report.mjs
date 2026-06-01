import nodemailer from "nodemailer";
const USER = process.env.GMAIL_USER;
const PASS = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
const TO = process.env.MAIL_TO || USER;
if (!USER || !PASS) { console.error("missing GMAIL_USER / GMAIL_APP_PASSWORD"); process.exit(1); }

const html = `
<div style="font-family:'Noto Sans TC',system-ui,sans-serif;line-height:1.7;color:#18181b;max-width:720px">
  <h2 style="margin:0 0 4px">淨新清潔工坊 CMS — 夜間加班報告</h2>
  <p style="color:#71717a;margin:0 0 16px">2026-06-01　全部已 commit + push 到 GitHub main，Vercel 會自動部署</p>

  <h3 style="color:#4f46e5">🔍 全域搜尋優化（主任務）</h3>
  <p><b>找到的根因（實測）：</b></p>
  <ul>
    <li>我先前為「查帳唯讀帳號」加的 RLS，讓老闆娘(一般帳號)搜尋慢近一倍——子表權限檢查逐列跑函式。</li>
    <li><code>order_items.item_code</code> 沒有 trigram 索引 → 每次都全表掃 2 萬筆。</li>
    <li>並行下整體 wall-clock 約 <b>2.3 秒</b>。</li>
  </ul>
  <p><b>處理（migration 0032，已套用資料庫）：</b></p>
  <ul>
    <li>RLS 改成「一般帳號直接短路、不再逐列跑函式」(標準寫法，Gemini+我雙確認低風險)。</li>
    <li><code>item_code</code> 補 GIN trigram 索引。</li>
    <li><b>實測：order_items 2278ms→365ms、整體序列 3475ms→1069ms；並行 wall-clock 約 2.3s → 0.4s。</b></li>
  </ul>
  <p><b>UI 兩段式（你的想法 1，已做）：</b></p>
  <ul>
    <li>上段「快速搜尋（電話/地址）」邊打邊即時——只查有索引的電話+地址，最快最常用。</li>
    <li>下段「完整搜尋（姓名/編號/訂單/機器/保固單）」打完按 Enter 才查（較重）。</li>
    <li>兩欄都加了範例提示（例：0912345678、員林建國路）避免誤用。</li>
  </ul>

  <h3 style="color:#4f46e5">❓ 你問的 Q3：即時 vs 按 Enter，哪個好？</h3>
  <p>兩者各有取捨，<b>關鍵在「查詢快不快」</b>：</p>
  <ul>
    <li><b>即時(邊打邊找)</b>：體驗最好，但每次停頓都送一次查詢；若查詢慢，會一直卡頓、浪費資料庫。</li>
    <li><b>按 Enter</b>：只查一次、最省資源，但要多一個動作。</li>
    <li><b>我的選擇（也是 Gemini 同意的最佳實踐）：</b>快速段(電話/地址，有索引、很快)用<b>即時</b>；完整段(跨多表、較重)用<b>Enter</b>。兼顧體驗與效能。</li>
  </ul>

  <h3 style="color:#4f46e5">✅ 你問的 Q2：顧客頁/訂單頁搜尋</h3>
  <p>已確認：它們搜尋用的欄位(姓名/編號/訂單編號/備註、電話走副電話表)都已有 trigram 索引，且同受惠於 0032 的 RLS 修正 → 已是快的，無需額外改動。</p>

  <h3 style="color:#4f46e5">📊 儀表板（你補的兩項）</h3>
  <ul>
    <li><b>本月取消率</b>卡片改為可點，直接連到「已取消訂單」清單。</li>
    <li><b>師傅案量</b>改為「<b>未完成案量</b>」(全時段待派工/已排案)，由少到多排序，老闆娘一眼看出該優先把新案派給誰(負荷最輕)。</li>
  </ul>

  <h3 style="color:#4f46e5">🤝 雙模型協作 & 安全</h3>
  <ul>
    <li>RLS 改寫前後都找 Gemini 對齊；意見相左處(它建議內聯 EXISTS)我以「避免先前踩過的無限遞迴」為重，保留 security-definer 函式——以問題解決優先。</li>
    <li>RLS 改完<b>重新驗證查帳帳號隔離</b>：0 筆洩漏、0 孤兒訂單、寫入仍被擋 → 隔離完全不受影響。</li>
  </ul>

  <h3 style="color:#4f46e5">📦 今晚的 commits</h3>
  <ul style="font-family:monospace;font-size:13px">
    <li>dbe3569 儀表板：取消率連結 + 師傅未完成案量</li>
    <li>57dc2e5 migration 0032：RLS 短路 + item_code trgm 索引</li>
    <li>c9f5553 全域搜尋拆兩段(快速即時 + 完整按Enter)</li>
  </ul>
  <p style="color:#71727a;font-size:13px">（更早今天還有：品牌數字排序、月曆只載近期、全日休紅色行、休假簡化、師傅代表色等，都已上線。）</p>

  <p style="margin-top:18px">睡飽再看就好，有要調整的再跟我說 🙂</p>
  <p style="color:#71717a;font-size:13px">— 仁格數位科技工坊</p>
</div>`;

const t = nodemailer.createTransport({ host: "smtp.gmail.com", port: 465, secure: true, auth: { user: USER, pass: PASS } });
const info = await t.sendMail({
  from: `"Ren Studio" <${USER}>`,
  to: TO,
  subject: "【淨新CMS】夜間加班報告：搜尋優化 + 儀表板調整（2026-06-01）",
  html,
});
console.log("SENT", info.messageId, "→", TO);
