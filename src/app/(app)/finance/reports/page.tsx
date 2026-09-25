import Link from "next/link";
import { redirect } from "next/navigation";
import { Download, FileBarChart } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { userHasPermission } from "@/lib/permissions";
import { formatTzs, getSelcomConfig, revenueReport } from "@/lib/integrations/selcom";
import { PERIODS, resolvePeriod } from "@/lib/report-period";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { cn } from "@/lib/cn";
import { EmptyState } from "@/components/ui/empty-state";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { Badge } from "@/components/ui/badge";
import { PrintButton } from "@/components/ui/PrintButton";
import { SyncForm } from "@/components/collections/SyncForm";
import { DailyBars, type DailyPoint } from "@/components/collections/DailyBars";

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4 min-w-0">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-base sm:text-lg md:text-xl font-semibold font-tabular break-words">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

function dayLabel(key: string) {
  return new Date(`${key}T12:00:00+03:00`).toLocaleDateString("en-GB", {
    timeZone: "Africa/Dar_es_Salaam",
    day: "2-digit",
    month: "short",
  });
}

function monthLabel(key: string) {
  return new Date(`${key}-15T12:00:00+03:00`).toLocaleDateString("en-GB", {
    timeZone: "Africa/Dar_es_Salaam",
    month: "short",
    year: "numeric",
  });
}

export default async function RevenueReportPage({ searchParams }: PageProps<"/finance/reports">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  const [canBanking, canSubscriber, canSyncBanking, canSyncSubscriber] = await Promise.all([
    userHasPermission(userId, "banking", "view"),
    userHasPermission(userId, "sales_subscriber", "view"),
    userHasPermission(userId, "banking", "edit"),
    userHasPermission(userId, "sales_subscriber", "edit"),
  ]);
  if (!canBanking && !canSubscriber) {
    return (
      <EmptyState
        icon={FileBarChart}
        title="No access"
        description="Your account doesn't hold a role with Banking or Subscriber revenue visibility."
      />
    );
  }

  const params = await searchParams;
  const period = resolvePeriod(params);
  const [report, lastRun, orderCount] = await Promise.all([
    revenueReport(period.from, period.toExclusive),
    prisma.integrationSyncRun.findFirst({ where: { provider: "selcom" }, orderBy: { startedAt: "desc" } }),
    prisma.selcomCollection.count(),
  ]);
  const configured = Boolean(getSelcomConfig());
  const canSync = canSyncBanking || canSyncSubscriber;
  const now = new Date();

  // More than two months of bars is unreadable on a phone: show months.
  const byMonth = report.days.length > 62;
  const points: DailyPoint[] = byMonth
    ? Object.values(
        report.days.reduce<Record<string, DailyPoint>>((acc, d) => {
          const k = d.date.slice(0, 7);
          acc[k] ??= { label: monthLabel(k), amount: 0, count: 0 };
          acc[k].amount += d.amount;
          acc[k].count += d.count;
          return acc;
        }, {}),
      )
    : report.days.map((d) => ({ label: dayLabel(d.date), amount: d.amount, count: d.count }));

  const exportHref = `/api/reports/revenue?from=${period.fromKey}&to=${period.toKey}`;

  return (
    <div className="space-y-6">
      {period.toExclusive > now && <AutoRefresh seconds={60} />}

      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Revenue report</h1>
          <p className="text-sm text-muted-foreground text-justify max-w-2xl">
            Payments customers made through Selcom for KASI-WIFI, read from Selcom in read-only mode.
            KASI does not collect or move money. {period.label}: {period.fromKey} to {period.toKey} (EAT).
          </p>
        </div>
        <div className="flex gap-2 print:hidden">
          <a
            href={exportHref}
            className="inline-flex items-center gap-2 rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-background"
          >
            <Download className="h-4 w-4" /> Export CSV
          </a>
          <PrintButton label="Print / PDF" />
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 print:hidden">
        {PERIODS.map((p) => (
          <Link
            key={p.key}
            href={`/finance/reports?period=${p.key}`}
            className={cn(
              "rounded-full border px-3 py-1 text-xs",
              period.key === p.key
                ? "border-primary bg-primary text-primary-foreground"
                : "border-border bg-surface hover:bg-background",
            )}
          >
            {p.label}
          </Link>
        ))}
        <form action="/finance/reports" className="flex flex-wrap items-center gap-2 text-xs">
          <input type="date" name="from" defaultValue={period.fromKey} className="rounded-md border border-border bg-surface px-2 py-1" aria-label="From" />
          <span className="text-muted-foreground">to</span>
          <input type="date" name="to" defaultValue={period.toKey} className="rounded-md border border-border bg-surface px-2 py-1" aria-label="To" />
          <button type="submit" className="rounded-md border border-border bg-surface px-3 py-1 hover:bg-background">
            Apply
          </button>
        </form>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Revenue received" value={formatTzs(report.total)} sub={`${report.count} successful payments`} />
        <Stat label="Average payment" value={formatTzs(report.average)} />
        <Stat
          label="Best day"
          value={formatTzs(Math.max(0, ...report.days.map((d) => d.amount)))}
          sub={(() => {
            const best = [...report.days].sort((a, b) => b.amount - a.amount)[0];
            return best && best.amount > 0 ? dayLabel(best.date) : "No payments";
          })()}
        />
        <Stat label="Not completed" value={String(report.unsuccessful + report.pending)} sub={`${report.unsuccessful} failed or cancelled, ${report.pending} pending`} />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold mb-4">Revenue per {byMonth ? "month" : "day"} (TZS)</h2>
          <DailyBars points={points} />
        </section>
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold mb-3">By payment channel</h2>
          {report.channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No successful payments in this period.</p>
          ) : (
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="pb-2 font-medium">Channel</th>
                  <th className="pb-2 font-medium text-right">Share</th>
                  <th className="pb-2 font-medium text-right">Amount</th>
                </tr>
              </thead>
              <tbody>
                {report.channels.map((c) => (
                  <tr key={c.channel} className="border-t border-border">
                    <td className="py-2">
                      {c.channel}
                      <span className="block text-xs text-muted-foreground">{c.count} payments</span>
                    </td>
                    <td className="py-2 text-right font-tabular">{(c.share * 100).toFixed(1)}%</td>
                    <td className="py-2 text-right font-tabular whitespace-nowrap">{formatTzs(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold mb-3">{byMonth ? "Monthly" : "Daily"} breakdown</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 font-medium">{byMonth ? "Month" : "Date"}</th>
                <th className="py-2 font-medium text-right">Payments</th>
                <th className="py-2 font-medium text-right">Revenue</th>
              </tr>
            </thead>
            <tbody>
              {[...points].reverse().map((p) => (
                <tr key={p.label} className="border-b border-border last:border-0">
                  <td className="py-2">{p.label}</td>
                  <td className="py-2 text-right font-tabular">{p.count}</td>
                  <td className="py-2 text-right font-tabular">{formatTzs(p.amount)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="border-t-2 border-border font-semibold">
                <td className="py-2">Total</td>
                <td className="py-2 text-right font-tabular">{report.count}</td>
                <td className="py-2 text-right font-tabular">{formatTzs(report.total)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 space-y-3 print:hidden">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h2 className="text-sm font-semibold">Data source: Selcom</h2>
          <Badge tone={configured ? "success" : "warning"}>
            {configured ? "Connected (read-only)" : "Not connected"}
          </Badge>
        </div>
        <p className="text-sm text-muted-foreground text-justify">
          {orderCount} Selcom orders stored.{" "}
          {lastRun
            ? `Last read from Selcom ${fmtRelative(lastRun.startedAt, now)} (${fmtDateTime(lastRun.startedAt)} EAT)${lastRun.status === "failed" ? `, which failed: ${lastRun.error}` : ""}.`
            : "Nothing has been read from Selcom yet."}{" "}
          KASI reads new orders automatically every 10 minutes once the scheduler is set up. Use the
          button to load history the first time, for example the last 12 months.
        </p>
        {!configured ? (
          <p className="text-sm text-status-warning">
            Add the Selcom API key and secret (the same ones set in BillNasi under Payment Gateway) to
            the deployment settings as SELCOM_API_KEY and SELCOM_API_SECRET.
          </p>
        ) : canSync ? (
          <SyncForm />
        ) : null}
      </section>
    </div>
  );
}
