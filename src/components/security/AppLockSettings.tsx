"use client";

import { useEffect, useState } from "react";
import { readLockSettings, writeLockSettings, type AppLockSettings } from "@/lib/app-lock";

const TIMEOUTS = [
  { minutes: 0, label: "Immediately" },
  { minutes: 1, label: "After 1 minute" },
  { minutes: 5, label: "After 5 minutes" },
  { minutes: 15, label: "After 15 minutes" },
  { minutes: 60, label: "After 1 hour" },
];

/** iOS-style switch plus the "require after" choice, stored on this device. */
export function AppLockSettingsCard({ hasPasskey }: { hasPasskey: boolean }) {
  const [settings, setSettings] = useState<AppLockSettings | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- stored on the device
    setSettings(readLockSettings());
  }, []);

  function update(next: AppLockSettings) {
    setSettings(next);
    writeLockSettings(next);
  }

  if (!settings) return <div className="h-24" />;

  return (
    <div className="divide-y divide-border">
      <label className="flex items-center justify-between gap-4 py-3">
        <span>
          <span className="block text-[15px] font-medium">Lock KASI on this device</span>
          <span className="block text-[13px] text-muted-foreground">
            {hasPasskey
              ? "Unlock with Face ID, fingerprint or device PIN, or your password."
              : "Unlock with your password. Set up Face ID or fingerprint above to use it here."}
          </span>
        </span>
        <button
          type="button"
          role="switch"
          aria-checked={settings.enabled}
          onClick={() => update({ ...settings, enabled: !settings.enabled })}
          className={`relative h-[31px] w-[51px] shrink-0 rounded-full transition-colors ${settings.enabled ? "bg-[#34c759]" : "bg-[#e9e9eb]"}`}
        >
          <span
            className={`absolute top-[2px] h-[27px] w-[27px] rounded-full bg-white shadow-[0_3px_8px_rgba(0,0,0,0.15),0_1px_1px_rgba(0,0,0,0.16)] transition-transform ${settings.enabled ? "translate-x-[22px]" : "translate-x-[2px]"}`}
          />
        </button>
      </label>
      <label className={`flex items-center justify-between gap-4 py-3 ${settings.enabled ? "" : "opacity-50"}`}>
        <span className="text-[15px] font-medium">Require unlock</span>
        <select
          value={settings.minutes}
          disabled={!settings.enabled}
          onChange={(e) => update({ ...settings, minutes: Number(e.target.value) })}
          className="rounded-lg border border-border bg-surface px-3 py-1.5 text-[15px]"
        >
          {TIMEOUTS.map((t) => (
            <option key={t.minutes} value={t.minutes}>
              {t.label}
            </option>
          ))}
        </select>
      </label>
      <div className="py-3">
        <button
          type="button"
          disabled={!settings.enabled}
          onClick={() => window.dispatchEvent(new CustomEvent("kasi:sim", { detail: { scenario: "lock" } }))}
          className="text-[15px] font-medium text-primary disabled:opacity-40"
        >
          Lock now to try it
        </button>
      </div>
    </div>
  );
}
