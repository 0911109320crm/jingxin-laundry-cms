import type { NextConfig } from "next";

// 全站使用台灣時區。設定 process.env.TZ 會讓 Node.js 所有 Date 操作
// (getHours / getMonth / Intl.DateTimeFormat 預設值) 都採用台灣本地時間，
// 避免 Vercel / Netlify 上預設 UTC 跟瀏覽器 (Taipei) 不一致。
process.env.TZ = "Asia/Taipei";

const nextConfig: NextConfig = {
  devIndicators: false,
};

export default nextConfig;
