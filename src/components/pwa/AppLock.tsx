"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import { Fingerprint, KeyRound, Lock, ScanFace } from "lucide-react";
import {
  passkeyVerifyOptionsAction,
  unlockWithPasskeyAction,
  unlockWithPasswordAction,
} from "@/lib/actions/passkeys";
import { signOutAction } from "@/lib/actions/session";
import { LAST_ACTIVE_KEY, LOCK_SETTINGS_EVENT, readLockSettings } from "@/lib/app-lock";
import { assertPasskey, describePasskeyError, passkeysSupported } from "@/lib/webauthn-client";

function lastActive(): number {
  try {
    return Number(localStorage.getItem(LAST_ACTIVE_KEY) ?? 0);
  } catch {
    return Date.now();
  }
}

function touch() {
  try {
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } catch {
    // Ignore: private browsing.
  }
}

/**
 * Locks KASI behind the device's own security when it comes back after
 * being away, like a banking app. Turned on per device under Security &
 * device. Unlocking checks a Face ID / fingerprint / PIN passkey, or the
 * account password, on the server.
 *
 * This guards an unattended phone that is still signed in. It is not a
 * replacement for signing out: the session itself still expires normally.
 */
export function AppLock({ hasPasskey, userName }: { hasPasskey: boolean; userName: string }) {
  const [locked, setLocked] = useState(false);
  const [mode, setMode] = useState<"device" | "password">("device");
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [apple, setApple] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);
  const canUseDevice = hasPasskey && typeof window !== "undefined" && passkeysSupported();

  const evaluate = useCallback(() => {
    const { enabled, minutes } = readLockSettings();
    if (!enabled) return setLocked(false);
    const away = Date.now() - lastActive();
    if (away > Math.max(minutes, 0) * 60 * 1000) setLocked(true);
  }, []);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- device settings live in the browser
    setApple(/iPhone|iPad|Macintosh/.test(navigator.userAgent));
    evaluate();

    const onVisibility = () => {
      if (document.visibilityState === "hidden") {
        touch();
        // "Immediately": lock before the app switcher takes its snapshot.
        const { enabled, minutes } = readLockSettings();
        if (enabled && minutes === 0) setLocked(true);
      } else {
        evaluate();
      }
    };
    const onSim = (e: Event) => {
      if ((e as CustomEvent<{ scenario?: string }>).detail?.scenario === "lock") setLocked(true);
    };
    const onSettings = () => {
      if (!readLockSettings().enabled) setLocked(false);
    };
    const heartbeat = setInterval(() => {
      if (document.visibilityState === "visible") touch();
    }, 20_000);

    document.addEventListener("visibilitychange", onVisibility);
    window.addEventListener("kasi:sim", onSim);
    window.addEventListener(LOCK_SETTINGS_EVENT, onSettings);
    return () => {
      clearInterval(heartbeat);
      document.removeEventListener("visibilitychange", onVisibility);
      window.removeEventListener("kasi:sim", onSim);
      window.removeEventListener(LOCK_SETTINGS_EVENT, onSettings);
    };
  }, [evaluate]);

  // Freeze the page underneath while locked.
  useEffect(() => {
    document.documentElement.style.overflow = locked ? "hidden" : "";
  }, [locked]);

  function unlocked() {
    touch();
    setLocked(false);
    setError(null);
    setMode("device");
  }

  async function unlockWithDevice() {
    setBusy(true);
    setError(null);
    try {
      const opts = await passkeyVerifyOptionsAction();
      if ("error" in opts && opts.error) throw new Error(opts.error);
      if (!("options" in opts) || !opts.options || !opts.challengeId) throw new Error("Could not start.");
      const response = await assertPasskey(opts.options);
      const result = await unlockWithPasskeyAction(opts.challengeId, response);
      if (result.ok) unlocked();
      else setError(result.error ?? "Not recognised.");
    } catch (e) {
      setError(describePasskeyError(e));
    } finally {
      setBusy(false);
    }
  }

  async function unlockWithPassword(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    setError(null);
    const result = await unlockWithPasswordAction(passwordRef.current?.value ?? "");
    setBusy(false);
    if (result.ok) unlocked();
    else setError(result.error ?? "Password is incorrect.");
  }

  if (!locked) return null;
  const DeviceIcon = apple ? ScanFace : Fingerprint;
  const showDevice = canUseDevice && mode === "device";

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="lock-title"
      className="fixed inset-0 z-[100] flex flex-col items-center justify-center px-6 text-white animate-[kasi-fade_0.2s_ease-out]"
      style={{
        background:
          "radial-gradient(70% 50% at 50% 0%, rgba(79,182,217,0.25), transparent 70%), linear-gradient(180deg, #0f2647 0%, #07162b 100%)",
      }}
    >
      <div className="w-full max-w-[340px] text-center">
        {/* eslint-disable-next-line @next/next/no-img-element -- static app icon */}
        <img src="/icons/icon-192.png" alt="" className="mx-auto h-16 w-16 rounded-[1.1rem] ring-1 ring-white/15" />
        <Lock className="mx-auto mt-6 h-5 w-5 text-white/60" />
        <h2 id="lock-title" className="mt-2 text-[22px] font-semibold tracking-tight">
          KASI is locked
        </h2>
        <p className="mt-1 text-[15px] text-white/60">{userName}</p>

        {showDevice ? (
          <button
            type="button"
            onClick={unlockWithDevice}
            disabled={busy}
            className="mx-auto mt-10 flex flex-col items-center gap-3 rounded-3xl px-8 py-5 transition hover:bg-white/5 active:scale-[0.98] disabled:opacity-60"
          >
            <DeviceIcon className="h-14 w-14 text-accent" strokeWidth={1.4} />
            <span className="text-[15px] font-medium">
              {busy ? "Waiting for your device…" : apple ? "Unlock with Face ID" : "Unlock with fingerprint"}
            </span>
          </button>
        ) : (
          <form onSubmit={unlockWithPassword} className="mt-10 space-y-3">
            <input
              ref={passwordRef}
              type="password"
              autoComplete="current-password"
              placeholder="KASI password"
              autoFocus
              className="w-full rounded-2xl border border-white/15 bg-white/10 px-4 py-3.5 text-[16px] text-white placeholder:text-white/40 outline-none focus:border-accent focus:ring-4 focus:ring-accent/25"
            />
            <button
              type="submit"
              disabled={busy}
              className="w-full rounded-2xl bg-white py-3.5 text-[15px] font-semibold text-[#0f2647] disabled:opacity-60"
            >
              {busy ? "Checking…" : "Unlock"}
            </button>
          </form>
        )}

        {error && <p className="mt-4 rounded-xl bg-white/10 px-3 py-2 text-[13px] text-[#ffb4b4]">{error}</p>}

        <div className="mt-8 flex items-center justify-center gap-6 text-[14px] text-white/70">
          {canUseDevice && (
            <button type="button" onClick={() => setMode(mode === "device" ? "password" : "device")} className="inline-flex items-center gap-1.5 hover:text-white">
              {mode === "device" ? <KeyRound className="h-4 w-4" /> : <DeviceIcon className="h-4 w-4" />}
              {mode === "device" ? "Use password" : apple ? "Use Face ID" : "Use fingerprint"}
            </button>
          )}
          <form action={signOutAction}>
            <button type="submit" className="hover:text-white">Sign out</button>
          </form>
        </div>
      </div>
    </div>
  );
}
