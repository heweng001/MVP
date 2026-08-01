import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "询盘管理系统",
  description: "WordPress 询盘接入、垃圾过滤与有效询盘统计",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="zh-CN">
      <body>{children}</body>
    </html>
  );
}
