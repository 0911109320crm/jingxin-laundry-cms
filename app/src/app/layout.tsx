import type { Metadata, Viewport } from "next";
import { Noto_Sans_TC } from "next/font/google";
import { PWARegister } from "@/components/PWARegister";
import "./globals.css";

const notoTC = Noto_Sans_TC({
  variable: "--font-noto-tc",
  subsets: ["latin"],
  display: "swap",
  weight: ["400", "500", "700"],
});

export const metadata: Metadata = {
  title: "淨新清潔工坊管理系統",
  description: "淨新清潔工坊後台管理系統",
  manifest: "/manifest.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-32.png", sizes: "32x32", type: "image/png" },
      { url: "/icon-192.png", sizes: "192x192", type: "image/png" },
    ],
    apple: [{ url: "/apple-icon.png", sizes: "180x180", type: "image/png" }],
  },
  appleWebApp: {
    capable: true,
    title: "淨新清潔工坊",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  // 鎖住雙指縮放：避免老闆娘/師傅在手機上不小心放大頁面、導致畫面超出螢幕
  maximumScale: 1,
  userScalable: false,
  viewportFit: "cover",
  themeColor: "#4f46e5",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-Hant-TW" className={`${notoTC.variable} h-full`}>
      <body className="min-h-full flex flex-col">
        {children}
        <PWARegister />
      </body>
    </html>
  );
}
