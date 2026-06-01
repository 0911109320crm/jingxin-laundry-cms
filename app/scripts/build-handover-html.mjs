// Build a self-contained handover HTML (screenshots embedded as base64).
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, resolve, join } from "node:path";

const __dirname = dirname(fileURLToPath(import.meta.url));
const SHOTS = resolve(__dirname, "..", "..", "handover-shots");
const OUT = resolve(__dirname, "..", "..", "jingxin-update-2026-05-31.html");

const img = (f) =>
  `data:image/png;base64,${readFileSync(join(SHOTS, f)).toString("base64")}`;

const sections = [
  {
    n: 1, tag: "建立訂單",
    title: "找客戶改成「打字搜尋」",
    points: [
      "客戶名單已破萬筆，不再用下拉選單慢慢拉。",
      "直接打<b>姓名、電話或編號</b>，符合的客戶就會即時跳出來，點一下就選定。",
    ],
    shot: "01-customer-search.png",
  },
  {
    n: 2, tag: "建立訂單",
    title: "機型選單純中文、可帶入客戶機器、欄位更清楚",
    points: [
      "機型選單拿掉看不懂的英文代號（WV-S、WTUB…），<b>只顯示中文 + 價格</b>。",
      "若這位客戶<b>之前登記過機器</b>，會多出「帶入此客戶的機器」可直接選，不用重打。",
      "原本用途不明的「代號」欄改名「<b>設備資訊</b>」，可補充說明，例：陽台那台、客廳冷氣。",
      "排好服務日期 + <b>每一項都指派了師傅</b>，訂單會自動變「已排案」；只要有一項沒派師傅就留在「待派工」。",
    ],
    shot: "02-order-form.png",
  },
  {
    n: 3, tag: "顧客資料",
    title: "「加入日期」改成「建檔日期」（自動記錄）",
    points: [
      "不用再手動填日期，系統會<b>自動記錄這位客人是哪天建檔的</b>。",
      "顧客列表與顧客頁都會顯示「建檔：日期」，匯出的 Excel 名單也同步改為「建檔日期」。",
    ],
    shot: "03-build-date.png",
  },
  {
    n: 4, tag: "顧客資料",
    title: "新增/編輯機器：拿掉「子類型」",
    points: [
      "機器登錄只留<b>類型 / 廠牌 / 型號 / 備註</b>，移除少用的「子類型」，畫面更乾淨。",
    ],
    shot: "04-machine-no-subtype.png",
  },
  {
    n: 5, tag: "系統設定",
    title: "品牌主檔清爽化",
    points: [
      "拿掉看不懂、也不用調的「排序」數字（系統自動排）。",
      "隱藏系統內部用的「(未知)」選項。",
      "修好雙槽式洗衣機分頁無法新增品牌的問題；清單改多欄排列，不再空一大片。",
    ],
    shot: "06-brands.png",
  },
  {
    n: 6, tag: "系統設定",
    title: "帳號管理：可直接修改密碼",
    points: [
      "點「鉛筆」編輯帳號時，<b>多了「新密碼」欄位</b>（留空＝不改），可一次改好姓名、角色、密碼。",
      "原本擠在一起的編輯欄位也重新排版，不再變形。",
    ],
    shot: null,
  },
];

const sectionHtml = sections.map((s) => `
  <section class="card">
    <div class="card-head">
      <span class="tag">${s.tag}</span>
      <h2><span class="num">${s.n}</span>${s.title}</h2>
    </div>
    <ul>${s.points.map((p) => `<li>${p}</li>`).join("")}</ul>
    ${s.shot ? `<figure><img src="${img(s.shot)}" alt="${s.title}"/></figure>` : ""}
  </section>`).join("");

const html = `<!doctype html>
<html lang="zh-Hant">
<head>
<meta charset="utf-8"/>
<meta name="viewport" content="width=device-width, initial-scale=1"/>
<meta name="robots" content="noindex"/>
<title>淨新清潔工坊 — 系統更新說明（2026-05-31）</title>
<style>
  :root{ --brand:#4f46e5; --ink:#18181b; --muted:#71717a; --line:#e4e4e7; --bg:#f4f4f5; }
  *{ box-sizing:border-box; }
  body{ margin:0; font-family:"Noto Sans TC","PingFang TC","Microsoft JhengHei",system-ui,sans-serif;
        color:var(--ink); background:var(--bg); line-height:1.7; -webkit-text-size-adjust:100%; }
  .wrap{ max-width:860px; margin:0 auto; padding:24px 18px 64px; }
  header.top{ text-align:center; padding:32px 16px 8px; }
  header.top .kicker{ color:var(--brand); font-weight:700; letter-spacing:.08em; font-size:13px; }
  header.top h1{ font-size:26px; margin:8px 0 4px; }
  header.top .date{ color:var(--muted); font-size:14px; }
  .intro{ background:#fff; border:1px solid var(--line); border-radius:14px; padding:16px 18px; margin:18px 0 26px; color:#3f3f46; font-size:15px; }
  .card{ background:#fff; border:1px solid var(--line); border-radius:16px; padding:20px 20px 22px; margin:18px 0;
         box-shadow:0 1px 2px rgba(0,0,0,.03); }
  .card-head{ margin-bottom:6px; }
  .tag{ display:inline-block; background:#eef2ff; color:var(--brand); font-size:12px; font-weight:700;
        padding:3px 10px; border-radius:999px; }
  .card h2{ font-size:19px; margin:10px 0 6px; display:flex; align-items:center; gap:10px; }
  .num{ display:inline-flex; width:28px; height:28px; flex:0 0 28px; align-items:center; justify-content:center;
        background:var(--brand); color:#fff; border-radius:50%; font-size:15px; }
  .card ul{ margin:8px 0 14px; padding-left:20px; }
  .card li{ margin:5px 0; color:#27272a; }
  figure{ margin:8px 0 0; }
  figure img{ width:100%; height:auto; border:1px solid var(--line); border-radius:12px; display:block; }
  footer{ text-align:center; color:var(--muted); font-size:13px; margin-top:36px; padding-top:18px; border-top:1px solid var(--line); }
  b{ color:#000; }
</style>
</head>
<body>
  <div class="wrap">
    <header class="top">
      <div class="kicker">淨新清潔工坊 · 管理系統</div>
      <h1>系統更新說明</h1>
      <div class="date">更新日期：2026 / 05 / 31</div>
    </header>
    <p class="intro">老闆娘您好，這次更新讓「建立訂單」更快、畫面更清楚，以下用圖文整理這次調整的 6 個地方，方便您快速上手。有任何不順手的地方再跟我說 🙂</p>
    ${sectionHtml}
    <footer>
      仁格數位科技工坊　·　系統維護<br/>
      本頁僅供交班參考，內容會依實際使用持續優化
    </footer>
  </div>
</body>
</html>`;

writeFileSync(OUT, html, "utf-8");
console.log("WROTE", OUT, `(${Math.round(html.length / 1024)} KB)`);
