import type { Metadata } from "next";
import { BottomNavWrapper } from "@/components/BottomNavWrapper";
import "./globals.css";

export const metadata: Metadata = {
  title: "Logos - 背经",
  description: "基于 FSRS 间隔重复的圣经背诵应用",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen pb-16">
        {children}
        <BottomNavWrapper />
      </body>
    </html>
  );
}
