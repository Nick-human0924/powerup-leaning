import type { Metadata, Viewport } from "next";
import "./globals.css";
import { appPath, publicDemo } from "@/lib/runtime";

export const metadata: Metadata = {
  title: publicDemo ? "英语小课堂 · 公开演示" : "安哲英语",
  description: "教材可追溯、练习有证据的英语复习助手",
  manifest: appPath("/manifest.webmanifest"),
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
  themeColor: "#f8f6f0",
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
