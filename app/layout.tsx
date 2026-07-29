import type { Metadata, Viewport } from "next";
import { BottomNavWrapper } from "@/components/BottomNavWrapper";
import { SWRegister } from "@/components/SWRegister";
import { ToastProvider } from "@/components/ToastProvider";
import "./globals.css";

export const metadata: Metadata = {
  title: "Logos - 背经",
  description: "基于 FSRS 间隔重复的圣经背诵应用",
  manifest: "/manifest.json",
};

export const viewport: Viewport = {
  themeColor: "#1a1a2e",
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className="antialiased min-h-screen pb-16">
        <ToastProvider>
        <SWRegister />
        {children}
        <BottomNavWrapper />
        </ToastProvider>
      </body>
    </html>
  );
}
