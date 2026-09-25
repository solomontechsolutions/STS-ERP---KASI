"use client";

import { useEffect, useState } from "react";
import { usePathname } from "next/navigation";
import { Menu, X } from "lucide-react";
import type { SerializableNavGroup } from "@/lib/nav";
import { Brand, NavLinks } from "@/components/layout/Sidebar";

/** Slide-in navigation for phones, where the desktop sidebar is hidden. */
export function MobileNav({ groups }: { groups: SerializableNavGroup[] }) {
  const [open, setOpen] = useState(false);
  const pathname = usePathname();

  // Close the drawer after navigating (including the back button).
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setOpen(false);
  }, [pathname]);

  return (
    <div className="md:hidden">
      <button
        type="button"
        aria-label="Open menu"
        onClick={() => setOpen(true)}
        className="-ml-2 rounded-md p-2 text-foreground hover:bg-background"
      >
        <Menu className="h-5 w-5" />
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex" role="dialog" aria-modal="true">
          <div className="absolute inset-0 bg-black/40" onClick={() => setOpen(false)} />
          <aside className="relative flex w-72 max-w-[85vw] flex-col bg-sidebar text-sidebar-foreground shadow-xl">
            <div className="flex items-center justify-between pr-3 border-b border-white/10">
              <Brand bordered={false} />
              <button
                type="button"
                aria-label="Close menu"
                onClick={() => setOpen(false)}
                className="rounded-md p-2 text-sidebar-foreground hover:bg-white/10"
              >
                <X className="h-5 w-5" />
              </button>
            </div>
            <NavLinks groups={groups} onNavigate={() => setOpen(false)} />
          </aside>
        </div>
      )}
    </div>
  );
}
