"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { BarChart3, Bell, Gavel, House, LayoutGrid, Video } from "lucide-react";
import { cn } from "@/lib/cn";

const ICONS = { home: House, board: Gavel, reports: BarChart3, meetings: Video, alerts: Bell } as const;
export type TabKey = keyof typeof ICONS;
export type Tab = { key: TabKey; label: string; href: string };

function active(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

/**
 * iOS-style tab bar for the phone app: the four places people go most, plus
 * "More" for the full menu. Sits above the home indicator on iPhone.
 */
export function MobileTabBar({ tabs, unreadCount }: { tabs: Tab[]; unreadCount: number }) {
  const pathname = usePathname();
  return (
    <nav
      aria-label="Main"
      className="md:hidden print:hidden fixed inset-x-0 bottom-0 z-40 border-t border-black/[0.06] bg-white/80 pb-[env(safe-area-inset-bottom)] backdrop-blur-2xl backdrop-saturate-150"
    >
      <ul className="mx-auto grid max-w-lg" style={{ gridTemplateColumns: `repeat(${tabs.length + 1}, minmax(0, 1fr))` }}>
        {tabs.map((tab) => {
          const Icon = ICONS[tab.key];
          const on = active(pathname, tab.href);
          return (
            <li key={tab.href}>
              <Link
                href={tab.href}
                className={cn(
                  "relative flex flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10.5px] font-medium tracking-tight",
                  on ? "text-primary" : "text-[#8e8e93]",
                )}
                aria-current={on ? "page" : undefined}
              >
                <span className="relative">
                  <Icon className="h-[24px] w-[24px]" strokeWidth={on ? 2.2 : 1.8} />
                  {tab.key === "alerts" && unreadCount > 0 && (
                    <span className="absolute -right-2 -top-1 min-w-[17px] rounded-full bg-status-danger px-1 text-center text-[10px] font-semibold leading-[17px] text-white">
                      {unreadCount > 99 ? "99+" : unreadCount}
                    </span>
                  )}
                </span>
                {tab.label}
              </Link>
            </li>
          );
        })}
        <li>
          <button
            type="button"
            onClick={() => window.dispatchEvent(new Event("kasi:open-menu"))}
            className="flex w-full flex-col items-center gap-0.5 pt-2 pb-1.5 text-[10.5px] font-medium tracking-tight text-[#8e8e93]"
          >
            <LayoutGrid className="h-[24px] w-[24px]" strokeWidth={1.8} />
            More
          </button>
        </li>
      </ul>
    </nav>
  );
}
