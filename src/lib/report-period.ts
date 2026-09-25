import { eatDateKey, eatDayStart } from "@/lib/integrations/selcom";

export const PERIODS = [
  { key: "today", label: "Today" },
  { key: "7d", label: "Last 7 days" },
  { key: "30d", label: "Last 30 days" },
  { key: "month", label: "This month" },
  { key: "lastmonth", label: "Last month" },
  { key: "year", label: "This year" },
] as const;

export type ReportPeriod = {
  key: string;
  label: string;
  /** Inclusive first day, yyyy-mm-dd (EAT). */
  fromKey: string;
  /** Inclusive last day, yyyy-mm-dd (EAT). */
  toKey: string;
  from: Date;
  toExclusive: Date;
};

const DAY = 24 * 60 * 60 * 1000;
const isDateKey = (v: unknown): v is string => typeof v === "string" && /^\d{4}-\d{2}-\d{2}$/.test(v);

function addDays(key: string, n: number) {
  return eatDateKey(new Date(eatDayStart(key).getTime() + n * DAY));
}

/**
 * Turns the report's query string into an exact EAT date range. A custom
 * range (from/to) wins over a preset; anything unreadable falls back to
 * "This month".
 */
export function resolvePeriod(params: { period?: unknown; from?: unknown; to?: unknown }, now = new Date()): ReportPeriod {
  const today = eatDateKey(now);
  const [y, m] = today.split("-").map(Number);
  const pad = (n: number) => String(n).padStart(2, "0");
  const monthStart = `${y}-${pad(m)}-01`;

  let key = typeof params.period === "string" ? params.period : "month";
  let fromKey: string;
  let toKey = today;

  if (isDateKey(params.from) && isDateKey(params.to) && params.from <= params.to) {
    key = "custom";
    fromKey = params.from;
    toKey = params.to;
  } else {
    switch (key) {
      case "today":
        fromKey = today;
        break;
      case "7d":
        fromKey = addDays(today, -6);
        break;
      case "30d":
        fromKey = addDays(today, -29);
        break;
      case "lastmonth": {
        const lm = m === 1 ? `${y - 1}-12-01` : `${y}-${pad(m - 1)}-01`;
        fromKey = lm;
        toKey = addDays(monthStart, -1);
        break;
      }
      case "year":
        fromKey = `${y}-01-01`;
        break;
      default:
        key = "month";
        fromKey = monthStart;
    }
  }

  const label =
    key === "custom"
      ? `${fromKey} to ${toKey}`
      : (PERIODS.find((p) => p.key === key)?.label ?? "This month");
  return {
    key,
    label,
    fromKey,
    toKey,
    from: eatDayStart(fromKey),
    toExclusive: eatDayStart(addDays(toKey, 1)),
  };
}
