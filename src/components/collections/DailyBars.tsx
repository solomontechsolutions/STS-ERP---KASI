import { formatTzs } from "@/lib/integrations/selcom";

export type DailyPoint = { label: string; amount: number; count: number };

/**
 * One series (money collected per day), so one hue and no legend: the
 * heading names it. Bars are anchored to the baseline with rounded tops,
 * separated by a 2px gap, and each carries a hover tooltip and an
 * aria-label so the value is never only visual.
 */
export function DailyBars({ points }: { points: DailyPoint[] }) {
  const max = Math.max(1, ...points.map((p) => p.amount));
  return (
    <div>
      <div className="flex h-40 items-end gap-[2px] border-b border-border" role="list">
        {points.map((p) => {
          const pct = (p.amount / max) * 100;
          return (
            <div
              key={p.label}
              role="listitem"
              aria-label={`${p.label}: ${formatTzs(p.amount)} from ${p.count} payments`}
              className="group relative flex h-full flex-1 items-end"
            >
              <div
                className="w-full rounded-t-[4px] bg-teal transition-opacity group-hover:opacity-80"
                style={{ height: p.amount > 0 ? `max(2px, ${pct}%)` : "0" }}
              />
              <div className="pointer-events-none absolute bottom-full left-1/2 z-10 mb-1 hidden -translate-x-1/2 whitespace-nowrap rounded-md border border-border bg-surface px-2 py-1 text-xs shadow-sm group-hover:block">
                <p className="font-medium">{p.label}</p>
                <p className="font-tabular">{formatTzs(p.amount)}</p>
                <p className="text-muted-foreground">{p.count} payments</p>
              </div>
            </div>
          );
        })}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-muted-foreground">
        <span>{points[0]?.label}</span>
        <span>{points[points.length - 1]?.label}</span>
      </div>
    </div>
  );
}
