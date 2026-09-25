"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import {
  Apple,
  BellRing,
  CheckCircle2,
  Circle,
  Download,
  Link2,
  Link2Off,
  Lock,
  Monitor,
  RotateCw,
  Smartphone,
} from "lucide-react";
import { cn } from "@/lib/cn";
import { sendTestPushAction } from "@/lib/actions/notifications";

const DESKTOP = { width: 1440, height: 900 };
const PHONE = { width: 390, height: 844 }; // iPhone 12 to 15 viewport

type QuickLink = { label: string; href: string };
export type Area = { group: string; label: string; href: string; planned: boolean };

const VISITED_KEY = "kasi-sim-visited";

function matchesArea(path: string, href: string) {
  const bare = path.split("?")[0];
  return href === "/" ? bare === "/" : bare === href || bare.startsWith(`${href}/`);
}

function loadVisited(): string[] {
  try {
    return JSON.parse(localStorage.getItem(VISITED_KEY) ?? "[]");
  } catch {
    return [];
  }
}

/** Never let the simulator load itself inside its own frames. */
function safePath(path: string) {
  const p = path.startsWith("/") ? path : `/${path}`;
  return p.startsWith("/simulator") ? "/" : p;
}

function currentPath(frame: HTMLIFrameElement | null): string | null {
  try {
    const loc = frame?.contentWindow?.location;
    return loc ? `${loc.pathname}${loc.search}` : null;
  } catch {
    return null; // navigated off-site: not readable, and not ours to follow
  }
}

/**
 * Shows the live KASI app twice, at desktop size and at phone size, side by
 * side. Both frames are the real app on this deployment (same origin, same
 * session), so whatever was last deployed is what appears. With "Linked"
 * on, navigating in either frame moves the other to the same page.
 */
export function DeviceSimulator({
  quickLinks,
  areas,
  initialPath,
}: {
  quickLinks: QuickLink[];
  areas: Area[];
  initialPath: string;
}) {
  const desktopRef = useRef<HTMLIFrameElement>(null);
  const phoneRef = useRef<HTMLIFrameElement>(null);
  const desktopBox = useRef<HTMLDivElement>(null);
  const [path, setPath] = useState(safePath(initialPath));
  const [input, setInput] = useState(safePath(initialPath));
  const [linked, setLinked] = useState(true);
  const [scale, setScale] = useState(0.5);
  const [nonce, setNonce] = useState(0);
  // Frames are navigated imperatively; this only changes on "Reload both", so
  // following a click inside one frame never reloads it from scratch.
  const [frameSrc, setFrameSrc] = useState(safePath(initialPath));
  const last = useRef({ desktop: path, phone: path });
  const [visited, setVisited] = useState<string[]>([]);
  const [notice, setNotice] = useState<string | null>(null);


  // Tick off every area either device has shown.
  const markVisited = useCallback(
    (p: string) => {
      const hit = areas.filter((a) => matchesArea(p, a.href)).map((a) => a.href);
      if (hit.length === 0) return;
      setVisited((prev) => {
        const next = [...new Set([...prev, ...hit])];
        if (next.length === prev.length) return prev;
        try {
          localStorage.setItem(VISITED_KEY, JSON.stringify(next));
        } catch {
          // Progress just won't survive a reload.
        }
        return next;
      });
    },
    [areas],
  );

  // Restore progress from earlier runs and count the opening page.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- progress is kept in this browser
    setVisited(loadVisited());
    markVisited(safePath(initialPath));
  }, [initialPath, markVisited]);

  // Fit the 1440px desktop viewport into the available column width.
  useEffect(() => {
    const el = desktopBox.current;
    if (!el) return;
    const ro = new ResizeObserver(([entry]) => setScale(Math.min(1, entry.contentRect.width / DESKTOP.width)));
    ro.observe(el);
    return () => ro.disconnect();
  }, []);

  const go = useCallback((next: string) => {
    const p = safePath(next);
    last.current = { desktop: p, phone: p };
    markVisited(p);
    setPath(p);
    setInput(p);
    for (const f of [desktopRef.current, phoneRef.current]) {
      if (f && currentPath(f) !== p) f.src = p;
    }
  }, [markVisited]);

  /** Fires a test scenario inside the phone frame (see InstallPrompt, AppLock). */
  function simulate(scenario: string) {
    const win = phoneRef.current?.contentWindow as (Window & typeof globalThis) | null | undefined;
    if (!win) return;
    win.dispatchEvent(new win.CustomEvent("kasi:sim", { detail: { scenario } }));
  }

  async function testNotification() {
    setNotice("Sending…");
    await sendTestPushAction();
    setNotice("Sent to every device you enabled, and to your KASI inbox.");
    go("/notifications");
    for (const f of [desktopRef.current, phoneRef.current]) f?.contentWindow?.location.reload();
  }

  // Follow navigation inside either frame. Next.js navigates without a full
  // page load, so the frames are polled rather than waiting for "load".
  useEffect(() => {
    const timer = setInterval(() => {
      const d = currentPath(desktopRef.current);
      const ph = currentPath(phoneRef.current);
      if (d && d !== last.current.desktop) {
        last.current.desktop = d;
        setInput(d);
        setPath(d);
        markVisited(d);
        if (linked && ph !== d) go(d);
      } else if (ph && ph !== last.current.phone) {
        last.current.phone = ph;
        setInput(ph);
        setPath(ph);
        markVisited(ph);
        if (linked && d !== ph) go(ph);
      }
    }, 600);
    return () => clearInterval(timer);
  }, [linked, go, markVisited]);

  // Opened from the menu inside one of the preview frames: don't nest.
  const [framed, setFramed] = useState(false);
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setFramed(window.self !== window.top);
  }, []);

  const phoneScale = 0.8;

  if (framed) {
    return <p className="text-sm text-muted-foreground">The preview is already open in the outer window.</p>;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <form
          className="flex flex-1 min-w-[240px] items-center gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            go(input);
          }}
        >
          <input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            className="flex-1 rounded-md border border-border bg-surface px-3 py-2 font-tabular text-sm"
            aria-label="Page to preview"
          />
          <button type="submit" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground">
            Open
          </button>
        </form>
        <button
          type="button"
          onClick={() => setLinked((v) => !v)}
          className={cn(
            "inline-flex items-center gap-1.5 rounded-md border px-3 py-2 text-sm",
            linked ? "border-accent bg-accent/10 text-teal" : "border-border bg-surface text-muted-foreground",
          )}
          title="When linked, navigating in one device moves the other too"
        >
          {linked ? <Link2 className="h-4 w-4" /> : <Link2Off className="h-4 w-4" />}
          {linked ? "Linked" : "Independent"}
        </button>
        <button
          type="button"
          onClick={() => {
            setFrameSrc(last.current.desktop);
            setNonce((n) => n + 1);
          }}
          className="inline-flex items-center gap-1.5 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-background"
        >
          <RotateCw className="h-4 w-4" /> Reload both
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5">
        {quickLinks.map((l) => (
          <button
            key={l.href}
            type="button"
            onClick={() => go(l.href)}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              path === l.href ? "border-primary bg-primary text-primary-foreground" : "border-border bg-surface hover:bg-background",
            )}
          >
            {l.label}
          </button>
        ))}
      </div>

      <div className="flex flex-wrap items-center gap-2 rounded-lg border border-border bg-surface px-3 py-2.5">
        <span className="mr-1 text-[13px] font-semibold">Test on the phone:</span>
        {[
          { key: "install-ios", icon: Apple, label: "iPhone install prompt" },
          { key: "install-android", icon: Download, label: "Android install prompt" },
          { key: "lock", icon: Lock, label: "App lock screen" },
        ].map((sc) => (
          <button
            key={sc.key}
            type="button"
            onClick={() => simulate(sc.key)}
            className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[13px] hover:bg-background"
          >
            <sc.icon className="h-4 w-4 text-primary" /> {sc.label}
          </button>
        ))}
        <button
          type="button"
          onClick={testNotification}
          className="inline-flex items-center gap-1.5 rounded-full border border-border px-3 py-1.5 text-[13px] hover:bg-background"
        >
          <BellRing className="h-4 w-4 text-primary" /> Test notification
        </button>
        {notice && <span className="text-[12px] text-muted-foreground">{notice}</span>}
      </div>

      <div className="flex flex-col xl:flex-row gap-6 items-start">
        <section className="w-full xl:flex-1 min-w-0">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Monitor className="h-4 w-4" /> Web, {DESKTOP.width} x {DESKTOP.height}
          </p>
          <div className="rounded-lg border border-border bg-surface shadow-sm overflow-hidden">
            <div className="flex items-center gap-1.5 border-b border-border bg-background px-3 py-2">
              <span className="h-2.5 w-2.5 rounded-full bg-status-danger/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-status-warning/60" />
              <span className="h-2.5 w-2.5 rounded-full bg-status-success/60" />
              <span className="ml-3 truncate rounded bg-surface px-2 py-0.5 text-xs text-muted-foreground font-tabular">
                {input}
              </span>
            </div>
            <div ref={desktopBox} className="relative w-full" style={{ height: DESKTOP.height * scale }}>
              <iframe
                key={`d${nonce}`}
                ref={desktopRef}
                src={frameSrc}
                title="Desktop preview"
                className="absolute left-0 top-0 origin-top-left border-0 bg-background"
                style={{ width: DESKTOP.width, height: DESKTOP.height, transform: `scale(${scale})` }}
              />
            </div>
          </div>
        </section>

        <section className="mx-auto shrink-0">
          <p className="mb-2 flex items-center gap-1.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            <Smartphone className="h-4 w-4" /> Phone app (PWA), {PHONE.width} x {PHONE.height}
          </p>
          <div
            className="rounded-[44px] border-[10px] border-[#1a1d21] bg-[#1a1d21] shadow-lg"
            style={{ width: PHONE.width * phoneScale + 20, height: PHONE.height * phoneScale + 20 }}
          >
            <div
              className="relative overflow-hidden rounded-[34px] bg-background"
              style={{ width: PHONE.width * phoneScale, height: PHONE.height * phoneScale }}
            >
              <iframe
                key={`p${nonce}`}
                ref={phoneRef}
                src={frameSrc}
                title="Phone preview"
                className="absolute left-0 top-0 origin-top-left border-0 bg-background"
                style={{ width: PHONE.width, height: PHONE.height, transform: `scale(${phoneScale})` }}
              />
            </div>
          </div>
        </section>
      </div>

      <div>
        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h2 className="text-[15px] font-semibold">
              Every area{" "}
              <span className="font-normal text-muted-foreground">
                ({areas.filter((a) => visited.includes(a.href)).length} of {areas.length} opened)
              </span>
            </h2>
            <button
              type="button"
              onClick={() => {
                setVisited([]);
                try {
                  localStorage.removeItem(VISITED_KEY);
                } catch {
                  // Nothing stored.
                }
              }}
              className="text-[13px] text-primary"
            >
              Start over
            </button>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-background">
            <div
              className="h-full rounded-full bg-[#34c759] transition-all"
              style={{ width: `${(areas.filter((a) => visited.includes(a.href)).length / Math.max(1, areas.length)) * 100}%` }}
            />
          </div>
          <div className="mt-4 grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-x-6">
            {[...new Set(areas.map((a) => a.group))].map((group) => (
              <div key={group} className="mb-3">
                <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-muted-foreground">{group}</p>
                <ul>
                  {areas
                    .filter((a) => a.group === group)
                    .map((a) => {
                      const done = visited.includes(a.href);
                      return (
                        <li key={a.href}>
                          <button
                            type="button"
                            onClick={() => go(a.href)}
                            className="flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-[14px] hover:bg-background"
                          >
                            {done ? (
                              <CheckCircle2 className="h-4 w-4 shrink-0 text-[#34c759]" />
                            ) : (
                              <Circle className="h-4 w-4 shrink-0 text-border" />
                            )}
                            <span className="flex-1">{a.label}</span>
                            {a.planned && (
                              <span className="rounded-full bg-background px-2 text-[11px] text-muted-foreground">coming later</span>
                            )}
                          </button>
                        </li>
                      );
                    })}
                </ul>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}
