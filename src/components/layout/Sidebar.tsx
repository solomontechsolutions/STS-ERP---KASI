"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/cn";
import type { SerializableNavGroup } from "@/lib/nav";

function isActive(pathname: string, href: string) {
  if (href === "/") return pathname === "/";
  // "/boardroom" must not stay highlighted on "/boardroom/decisions".
  if (href === "/boardroom") return pathname === "/boardroom";
  return pathname.startsWith(href);
}

export function NavLinks({
  groups,
  onNavigate,
}: {
  groups: SerializableNavGroup[];
  onNavigate?: () => void;
}) {
  const pathname = usePathname();
  return (
    <nav className="flex-1 overflow-y-auto py-4 px-3 space-y-6">
      {groups.map((group) => (
        <div key={group.label}>
          <p className="px-2 mb-1.5 text-[11px] font-medium uppercase tracking-wider text-sidebar-foreground/50">
            {group.label}
          </p>
          <ul className="space-y-0.5">
            {group.items.map((item) => (
              <li key={item.href}>
                <Link
                  href={item.href}
                  onClick={onNavigate}
                  className={cn(
                    "block rounded-md px-2.5 py-2 md:py-1.5 text-sm transition-colors",
                    isActive(pathname, item.href)
                      ? "bg-white/10 text-sidebar-foreground-active font-medium"
                      : "text-sidebar-foreground hover:bg-white/5 hover:text-sidebar-foreground-active",
                  )}
                >
                  {item.label}
                </Link>
              </li>
            ))}
          </ul>
        </div>
      ))}
    </nav>
  );
}

export function Brand({ bordered = true }: { bordered?: boolean }) {
  return (
    <div className={cn("flex items-center gap-2 px-5 h-16", bordered && "border-b border-white/10")}>
      <span className="font-heading text-lg font-bold text-sidebar-foreground-active tracking-tight">
        KASI
      </span>
      <span className="text-xs text-sidebar-foreground/70">STS</span>
    </div>
  );
}

export function Sidebar({ groups }: { groups: SerializableNavGroup[] }) {
  return (
    <aside className="hidden md:flex print:hidden w-64 shrink-0 flex-col bg-sidebar text-sidebar-foreground">
      <Brand />
      <NavLinks groups={groups} />
    </aside>
  );
}
