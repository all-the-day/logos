"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  { href: "/plan", label: "计划", icon: "M12 2L2 7v14h6v-6h8v6h6V7L12 2z" },
  { href: "/learn", label: "学习", icon: "M12 2L2 7v14h6v-6h8v6h6V7L12 2z" },
  { href: "/review", label: "复习", icon: "M12 2L2 7v14h6v-6h8v6h6V7L12 2z" },
  { href: "/notes", label: "笔记", icon: "M12 2L2 7v14h6v-6h8v6h6V7L12 2z" },
  { href: "/settings", label: "设置", icon: "M12 2L2 7v14h6v-6h8v6h6V7L12 2z" },
];

export default function BottomNav() {
  const pathname = usePathname();

  return (
    <nav className="fixed bottom-0 left-0 right-0 border-t bg-background z-50">
      <div className="flex justify-around items-center h-16 max-w-lg mx-auto">
        {navItems.map((item) => {
          const isActive = pathname === item.href;
          return (
            <Link
              key={item.href}
              href={item.href}
              className={`flex flex-col items-center gap-1 px-3 py-2 text-xs transition-colors ${
                isActive
                  ? "text-primary"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                viewBox="0 0 24 24"
                fill={isActive ? "currentColor" : "none"}
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                <path d={item.icon} />
              </svg>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
