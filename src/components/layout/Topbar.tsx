import Link from "next/link";
import { Bell } from "lucide-react";
import { signOut } from "@/auth";
import type { SerializableNavGroup } from "@/lib/nav";
import { MobileNav } from "@/components/layout/MobileNav";

export function Topbar({
  userName,
  roleLabels,
  navGroups,
  unreadCount,
}: {
  userName: string;
  roleLabels: string[];
  navGroups: SerializableNavGroup[];
  unreadCount: number;
}) {
  return (
    <header className="print:hidden h-16 shrink-0 border-b border-border bg-surface flex items-center justify-between gap-3 px-4 md:px-6">
      <div className="flex items-center gap-2">
        <MobileNav groups={navGroups} />
        <span className="md:hidden font-heading font-bold text-primary">KASI</span>
      </div>
      <div className="flex items-center gap-3 md:gap-4 min-w-0">
        <Link
          href="/notifications"
          aria-label={`Notifications${unreadCount ? `, ${unreadCount} unread` : ""}`}
          className="relative rounded-md p-2 text-muted-foreground hover:bg-background hover:text-foreground"
        >
          <Bell className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute -top-0.5 -right-0.5 min-w-[18px] h-[18px] rounded-full bg-status-danger px-1 text-[10px] font-semibold leading-[18px] text-white text-center">
              {unreadCount > 99 ? "99+" : unreadCount}
            </span>
          )}
        </Link>
        <div className="text-right min-w-0 hidden sm:block">
          <p className="text-sm font-medium leading-tight truncate">{userName}</p>
          <p className="text-xs text-muted-foreground leading-tight truncate">
            {roleLabels.join(" · ") || "No roles assigned"}
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors whitespace-nowrap"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
