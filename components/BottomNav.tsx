"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const navItems = [
  {
    href: "/plan",
    label: "计划",
    icon: [
      "M16 4h2a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H6a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2h2",
      "M15 2H9a1 1 0 0 0-1 1v2a1 1 0 0 0 1 1h6a1 1 0 0 0 1-1V3a1 1 0 0 0-1-1z",
      "M9 13l2 2 4-4",
    ],
  },
  {
    href: "/notes",
    label: "笔记",
    icon: [
      "M17 3a2.83 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5z",
      "M15 5l4 4",
    ],
  },
  {
    href: "/settings",
    label: "设置",
    icon: [
      "M4 21v-7",
      "M4 10V3",
      "M12 21v-9",
      "M12 8V3",
      "M20 21v-5",
      "M20 12V3",
      "M1 14h6",
      "M9 8h6",
      "M17 16h6",
    ],
  },
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
                fill="none"
                stroke="currentColor"
                strokeWidth={2}
                strokeLinecap="round"
                strokeLinejoin="round"
                className="w-5 h-5"
              >
                {item.icon.map((d, i) => (
                  <path key={i} d={d} />
                ))}
              </svg>
              <span>{item.label}</span>
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
