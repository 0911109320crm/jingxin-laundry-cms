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
  title: "淨新洗衣管理系統",
  description: "淨新洗衣機清潔工坊後台管理系統",
  manifest: "/manifest.webmanifest",
  appleWebApp: {
    capable: true,
    title: "淨新洗衣",
    statusBarStyle: "default",
  },
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
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
