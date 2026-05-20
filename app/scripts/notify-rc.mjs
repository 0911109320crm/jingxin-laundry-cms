#!/usr/bin/env node
/**
 * 透過 Gmail SMTP 寄信給 RC。用於自動化工作完成後通知。
 *
 * 環境變數:
 *   SMTP_USER  (預設 borenchang@gmail.com)
 *   SMTP_PASS  (必填，Gmail App Password，16 字元無空格)
 *   SMTP_TO    (預設等於 SMTP_USER)
 *
 * Usage:
 *   SMTP_PASS=xxxxxxxxxxxxxxxx node scripts/notify-rc.mjs --subject "標題" --body-file message.md
 *
 * 或內嵌:
 *   SMTP_PASS=xxxx node scripts/notify-rc.mjs --subject "..." --body "純文字內容"
 */
import nodemailer from "nodemailer";
import { readFileSync } from "node:fs";

function arg(name, def) {
  const i = process.argv.indexOf(`--${name}`);
  return i >= 0 ? process.argv[i + 1] : def;
}

const user = process.env.SMTP_USER || "borenchang@gmail.com";
const pass = process.env.SMTP_PASS;
const to = process.env.SMTP_TO || user;
const subject = arg("subject", "通知");
const bodyFile = arg("body-file", null);
const bodyInline = arg("body", null);

if (!pass) {
  console.error("Missing SMTP_PASS env var (Gmail App Password)");
  process.exit(1);
}
const body = bodyFile ? readFileSync(bodyFile, "utf-8") : bodyInline ?? "（無內容）";

const transporter = nodemailer.createTransport({
  host: "smtp.gmail.com",
  port: 465,
  secure: true,
  auth: { user, pass },
});

try {
  const info = await transporter.sendMail({
    from: `"Ren Studio Bot" <${user}>`,
    to,
    subject,
    text: body,
  });
  console.log("✅ Email sent:", info.messageId);
} catch (err) {
  console.error("❌ Send failed:", err.message);
  process.exit(2);
}
