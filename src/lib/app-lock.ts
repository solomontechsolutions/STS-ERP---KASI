"use client";

/**
 * App lock preferences belong to the device, not the account: a director
 * may want Face ID on their phone but not on the office desktop. They live
 * in localStorage and are read by <AppLock />.
 */
export type AppLockSettings = { enabled: boolean; minutes: number };

const SETTINGS_KEY = "kasi-app-lock";
export const LAST_ACTIVE_KEY = "kasi-last-active";
export const LOCK_SETTINGS_EVENT = "kasi:lock-settings";

export function readLockSettings(): AppLockSettings {
  try {
    const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) ?? "null");
    if (raw && typeof raw.enabled === "boolean" && typeof raw.minutes === "number") return raw;
  } catch {
    // Unavailable storage means the lock is simply off.
  }
  return { enabled: false, minutes: 5 };
}

export function writeLockSettings(settings: AppLockSettings) {
  try {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify(settings));
    localStorage.setItem(LAST_ACTIVE_KEY, String(Date.now()));
  } catch {
    // Ignore: private browsing.
  }
  window.dispatchEvent(new Event(LOCK_SETTINGS_EVENT));
}
