"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

// Only show bottom nav on main pages; /learn 是沉浸式背诵场景，隐藏底栏避免误触跳走
const NAV_PAGES = ["/plan", "/notes", "/settings"];

export function BottomNavWrapper() {
  const pathname = usePathname();

  if (!NAV_PAGES.includes(pathname)) {
    return null;
  }

  return <BottomNav />;
}
