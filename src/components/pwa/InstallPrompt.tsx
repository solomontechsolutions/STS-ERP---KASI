"use client";

import { useEffect, useState } from "react";
import { BellRing, Download, Fingerprint, MoreVertical, PlusSquare, Share, X, Zap } from "lucide-react";

type Variant = "android" | "ios" | "other";

interface BeforeInstallPromptEvent extends Event {
  prompt: () => Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

const DISMISS_KEY = "kasi-install-dismissed-at";
const DISMISS_DAYS = 7;

function isStandalone() {
  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    (navigator as Navigator & { standalone?: boolean }).standalone === true
  );
}

function detectVariant(): Variant {
  const ua = navigator.userAgent;
  const ios = /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
  return ios ? "ios" : "other";
}

function isPhoneOrTablet() {
  return window.matchMedia("(pointer: coarse)").matches && window.matchMedia("(max-width: 1100px)").matches;
}

function recentlyDismissed() {
  try {
    const at = Number(localStorage.getItem(DISMISS_KEY) ?? 0);
    return Date.now() - at < DISMISS_DAYS * 24 * 60 * 60 * 1000;
  } catch {
    return false;
  }
}

/**
 * Asks people who open KASI in a phone browser to install it as an app.
 *
 * Android (Chrome, Edge, Samsung Internet) offers a real install dialog,
 * captured through `beforeinstallprompt` and shown behind our own button.
 * iPhone and iPad have no such API, so the sheet shows Safari's
 * Share, then Add to Home Screen steps. "Not now" hides it for a week.
 *
 * The web and phone preview can force either version with a `kasi:sim`
 * event ({ scenario: "install-ios" | "install-android" }) to test it.
 */
export function InstallPrompt() {
  const [variant, setVariant] = useState<Variant | null>(null);
  const [deferred, setDeferred] = useState<BeforeInstallPromptEvent | null>(null);
  const [simulated, setSimulated] = useState(false);

  useEffect(() => {
    const onBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferred(e as BeforeInstallPromptEvent);
      if (!isStandalone() && isPhoneOrTablet() && !recentlyDismissed()) setVariant("android");
    };
    const onInstalled = () => setVariant(null);
    const onSim = (e: Event) => {
      const scenario = (e as CustomEvent<{ scenario?: string }>).detail?.scenario;
      if (scenario === "install-ios" || scenario === "install-android") {
        setSimulated(true);
        setVariant(scenario === "install-ios" ? "ios" : "android");
      }
    };
    window.addEventListener("beforeinstallprompt", onBeforeInstall);
    window.addEventListener("appinstalled", onInstalled);
    window.addEventListener("kasi:sim", onSim);

    // iOS never fires beforeinstallprompt: decide after a short delay so a
    // Chromium browser has the chance to fire it first.
    const timer = setTimeout(() => {
      if (isStandalone() || !isPhoneOrTablet() || recentlyDismissed()) return;
      setVariant((v) => v ?? detectVariant());
    }, 1500);

    return () => {
      clearTimeout(timer);
      window.removeEventListener("beforeinstallprompt", onBeforeInstall);
      window.removeEventListener("appinstalled", onInstalled);
      window.removeEventListener("kasi:sim", onSim);
    };
  }, []);

  function dismiss() {
    if (!simulated) {
      try {
        localStorage.setItem(DISMISS_KEY, String(Date.now()));
      } catch {
        // Private mode: the sheet simply shows again next time.
      }
    }
    setVariant(null);
    setSimulated(false);
  }

  async function install() {
    if (!deferred) return;
    await deferred.prompt();
    const { outcome } = await deferred.userChoice;
    setDeferred(null);
    if (outcome === "accepted") setVariant(null);
  }

  if (!variant) return null;

  return (
    <div className="fixed inset-0 z-[90] flex items-end justify-center p-3 pb-[calc(0.75rem+env(safe-area-inset-bottom))]">
      <div aria-hidden className="absolute inset-0 bg-black/35 animate-[kasi-fade_0.25s_ease-out]" onClick={dismiss} />
      <div
        role="dialog"
        aria-labelledby="install-title"
        className="relative w-full max-w-md rounded-[1.75rem] bg-white p-5 shadow-[0_20px_60px_rgba(15,38,71,0.35)] animate-[kasi-sheet_0.35s_ease-out]"
      >
        <div className="flex items-start gap-3">
          {/* eslint-disable-next-line @next/next/no-img-element -- static app icon */}
          <img src="/icons/icon-192.png" alt="" className="h-14 w-14 rounded-[1rem] shadow-sm" />
          <div className="flex-1 min-w-0">
            <p id="install-title" className="text-[17px] font-semibold tracking-tight text-foreground">
              Install KASI on this phone
            </p>
            <p className="text-[13px] text-muted-foreground">Solomon Tech Solutions</p>
          </div>
          <button
            type="button"
            onClick={dismiss}
            aria-label="Close"
            className="-mr-1 -mt-1 rounded-full p-1.5 text-muted-foreground hover:bg-black/5"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <ul className="mt-4 grid grid-cols-3 gap-2 text-center text-[12px] text-muted-foreground">
          <li className="rounded-2xl bg-[#f2f2f7] px-2 py-3">
            <Zap className="mx-auto mb-1 h-5 w-5 text-primary" /> Opens full screen
          </li>
          <li className="rounded-2xl bg-[#f2f2f7] px-2 py-3">
            <Fingerprint className="mx-auto mb-1 h-5 w-5 text-primary" /> Face ID and fingerprint
          </li>
          <li className="rounded-2xl bg-[#f2f2f7] px-2 py-3">
            <BellRing className="mx-auto mb-1 h-5 w-5 text-primary" /> Notifications
          </li>
        </ul>

        {variant === "ios" ? (
          <ol className="mt-4 space-y-2.5 text-[15px]">
            <li className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-[13px] font-semibold text-white">1</span>
              <span>
                Tap <Share className="mx-0.5 inline h-[18px] w-[18px] align-[-3px] text-[#0a84ff]" /> <strong>Share</strong> in Safari&apos;s toolbar
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-[13px] font-semibold text-white">2</span>
              <span>
                Choose <PlusSquare className="mx-0.5 inline h-[18px] w-[18px] align-[-3px]" /> <strong>Add to Home Screen</strong>
              </span>
            </li>
            <li className="flex items-center gap-3">
              <span className="grid h-7 w-7 shrink-0 place-items-center rounded-full bg-primary text-[13px] font-semibold text-white">3</span>
              <span>
                Tap <strong>Add</strong>, then open KASI from your home screen
              </span>
            </li>
          </ol>
        ) : variant === "android" && (deferred || simulated) ? (
          <button
            type="button"
            onClick={install}
            className="mt-4 flex w-full items-center justify-center gap-2 rounded-2xl bg-primary py-3.5 text-[16px] font-semibold text-white active:scale-[0.99]"
          >
            <Download className="h-5 w-5" /> Install app
          </button>
        ) : (
          <p className="mt-4 text-[15px]">
            Open the browser menu <MoreVertical className="inline h-4 w-4 align-[-2px]" /> and choose{" "}
            <strong>Install app</strong> or <strong>Add to Home screen</strong>.
          </p>
        )}

        <button
          type="button"
          onClick={dismiss}
          className="mt-3 w-full rounded-2xl py-2.5 text-[15px] font-medium text-primary hover:bg-black/[0.03]"
        >
          Not now
        </button>
      </div>
    </div>
  );
}
