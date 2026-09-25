/** All KASI users are in Tanzania: show times in East Africa Time. */
const TZ = "Africa/Dar_es_Salaam";

export function fmtDateTime(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toLocaleString("en-GB", { timeZone: TZ, dateStyle: "medium", timeStyle: "short" });
}

export function fmtDate(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toLocaleDateString("en-GB", { timeZone: TZ, day: "2-digit", month: "short", year: "numeric" });
}

export function fmtTime(date: Date | null | undefined): string {
  if (!date) return "";
  return date.toLocaleTimeString("en-GB", { timeZone: TZ, hour: "2-digit", minute: "2-digit" });
}

/** "in 3 h", "5 min ago": rough, for list rows. */
export function fmtRelative(date: Date, now = new Date()): string {
  const diff = date.getTime() - now.getTime();
  const abs = Math.abs(diff);
  const units: [number, string][] = [
    [24 * 60 * 60 * 1000, "d"],
    [60 * 60 * 1000, "h"],
    [60 * 1000, "min"],
  ];
  for (const [ms, label] of units) {
    if (abs >= ms) {
      const n = Math.round(abs / ms);
      return diff > 0 ? `in ${n} ${label}` : `${n} ${label} ago`;
    }
  }
  return diff > 0 ? "in under a minute" : "just now";
}
