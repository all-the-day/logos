"use client";

import { usePathname } from "next/navigation";
import BottomNav from "./BottomNav";

// Only show bottom nav on main pages
const NAV_PAGES = ["/plan", "/learn", "/notes", "/settings"];

export function BottomNavWrapper() {
  const pathname = usePathname();

  if (!NAV_PAGES.includes(pathname)) {
    return null;
  }

  return <BottomNav />;
}
