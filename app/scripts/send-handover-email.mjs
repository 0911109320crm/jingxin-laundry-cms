// Send the handover URL + Q&A summary by Gmail SMTP.
// Secrets come from env (never hard-coded): GMAIL_USER, GMAIL_APP_PASSWORD.
import nodemailer from "nodemailer";

const USER = process.env.GMAIL_USER;
const PASS = (process.env.GMAIL_APP_PASSWORD || "").replace(/\s+/g, "");
const TO = process.env.MAIL_TO || USER;
const URL = process.env.HANDOVER_URL || "";
if (!USER || !PASS) { console.error("missing GMAIL_USER / GMAIL_APP_PASSWORD"); process.exit(1); }

const html = `
<div style="font-family:'Noto Sans TC',system-ui,sans-serif;line-height:1.7;color:#18181b;max-width:680px">
  <h2 style="margin:0 0 4px">淨新清潔工坊 CMS — 今日進度 + 你問的問題回覆</h2>
  <p style="color:#71717a;margin:0 0 16px">2026-05-31</p>

  <h3 style="color:#4f46e5">📄 交班說明網址（可直接傳給老闆娘）</h3>
  <p><a href="${URL}" style="font-size:16px">${URL}</a></p>
  <p style="color:#71717a;font-size:13px">圖文整理這次 6 項更新；截圖內的客戶姓名/電話/地址已全部打碼，安全可外傳。</p>

  <h3 style="color:#4f46e5">✅ 今日已完成並上線（push 到 main）</h3>
  <ol>
    <li>建單客戶改「即時搜尋」（破萬筆客戶不再用下拉）</li>
    <li>建單服務選單純中文、隱藏內部代號；可帶入該客戶已登錄機器；「代號」欄改「設備資訊」</li>
    <li>派工判定改嚴謹：排程日 + <b>所有</b>項目都派師傅才算「已排案」</li>
    <li>顧客「加入日期」改「建檔日期」（系統自動，列表/詳情/匯出同步）</li>
    <li>顧客機器登錄移除「子類型」</li>
    <li>系統設定品牌主檔：隱藏排序與「(未知)」、修雙槽式新增品牌 bug、清單改多欄</li>
    <li>帳號管理：點鉛筆編輯可<b>直接改密碼</b>（留空＝不改）＋修正擠壓版面</li>
  </ol>
  <p style="color:#71717a;font-size:13px">commits：7efe3fa、37051f8、c1c7552；service_items 改名/旗標(migration 0023)已直接套到資料庫。</p>

  <h3 style="color:#4f46e5">❓ 你問的問題回覆</h3>
  <ul>
    <li><b>「加入日期」是什麼？</b>原本是「手動填」的欄位（不是自動建檔時間）；依你指示已改成自動記錄的<b>建檔日期</b>(created_at)，每筆都有值、不用再填。</li>
    <li><b>WV-S / WTUB 代號哪來的？</b>是我（開發）自創的內部 SKU 碼，<b>非老闆娘匯入資料</b>（你們本來都用中文）。已從建單下拉隱藏，只顯示中文品名＋價格。</li>
    <li><b>「建檔日期欄位消失」是你藏的嗎？</b>是的，刻意把「新增/編輯顧客」表單裡那個<b>手填日期欄位</b>拿掉——因為改成系統自動記錄。它仍會自動顯示在顧客列表/詳情（標示「建檔：日期」）。若你想要還能手動調整，跟我說我再加回可編輯欄位。</li>
    <li><b>床墊基本價？</b>你決定「兩個都留」→ 建單下拉保留床墊除蟎(1300)＋床墊清洗(1800)，共 7 個中文選項。</li>
  </ul>

  <h3 style="color:#b45309">⏳ 還沒做 / 需要你配合的</h3>
  <ul>
    <li><b>機器類型下拉改細分</b>（直立/滾筒/分離/吊隱…）：程式我準備好了，但要改 Postgres enum，這是 DDL，我手上沒有資料庫 DDL 權限（只有 service key 能跑資料異動、不能改結構）。請在 <b>Supabase SQL Editor 跑 migration 0024</b>（檔案已在 repo：supabase/migrations/0024_machine_type_granular.sql，純新增、安全），跑完跟我說我就把下拉切過去；或把 DB 連線密碼給我我直接處理。為避免存檔報錯，<b>migration 跑之前我不會把新類型上線</b>。</li>
    <li><b>PWA 月曆派案總覽頁 + 師傅休假（全日/上午/下午休）</b>：這是最大的一塊，含新資料表(師傅休假)與整頁重做，我會先出設計方案給你確認再動工（也會需要跑新 migration）。</li>
  </ul>

  <p style="color:#71717a;font-size:13px;margin-top:20px">— 仁格數位科技工坊</p>
</div>`;

const t = nodemailer.createTransport({
  host: "smtp.gmail.com", port: 465, secure: true,
  auth: { user: USER, pass: PASS },
});
const info = await t.sendMail({
  from: `"Ren Studio" <${USER}>`,
  to: TO,
  subject: "【淨新CMS】系統更新交班網址 + 你問的問題回覆（2026-05-31）",
  html,
});
console.log("SENT", info.messageId, "→", TO);
