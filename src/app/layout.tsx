import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "GlobalMatch - 出海全链路操作系统",
  description: "帮出海外贸人找真正会回复的买家，质量驱动，真实数据+AI分析",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="zh-CN">
      <body className="min-h-screen bg-background antialiased">{children}</body>
    </html>
  );
}
