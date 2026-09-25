import Link from "next/link";
import { redirect } from "next/navigation";
import { Wallet } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { userHasPermission } from "@/lib/permissions";
import {
  collectedSince,
  formatTzs,
  getSelcomConfig,
  startOfEatDay,
} from "@/lib/integrations/selcom";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { Badge, statusTone } from "@/components/ui/badge";
import { SyncForm } from "@/components/collections/SyncForm";
import { DailyBars, type DailyPoint } from "@/components/collections/DailyBars";

const DAY = 24 * 60 * 60 * 1000;

function Stat({ label, value, sub }: { label: string; value: string; sub?: string }) {
  return (
    <div className="rounded-lg border border-border bg-surface p-4">
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="mt-1 text-xl font-semibold font-tabular">{value}</p>
      {sub && <p className="text-xs text-muted-foreground mt-0.5">{sub}</p>}
    </div>
  );
}

export default async function CollectionsPage({
  searchParams,
}: PageProps<"/finance/collections">) {
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
        icon={Wallet}
        title="No access"
        description="Your account doesn't hold a role with Banking or Subscriber revenue visibility."
      />
    );
  }
  const canSync = canSyncBanking || canSyncSubscriber;

  const { status: statusParam } = await searchParams;
  const statusFilter = typeof statusParam === "string" ? statusParam.toUpperCase() : "ALL";

  const now = new Date();
  const today = startOfEatDay(now);
  const weekStart = new Date(today.getTime() - 6 * DAY);
  const eatNow = new Date(now.getTime() + 3 * 60 * 60 * 1000);
  const monthStart = new Date(
    Date.UTC(eatNow.getUTCFullYear(), eatNow.getUTCMonth(), 1) - 3 * 60 * 60 * 1000,
  );
  const chartStart = new Date(today.getTime() - 13 * DAY);

  const [todayTotals, weekTotals, monthTotals, pendingCount, recent, byChannel, chartRows, lastRun, lastPayment] =
    await Promise.all([
      collectedSince(today),
      collectedSince(weekStart),
      collectedSince(monthStart),
      prisma.selcomCollection.count({ where: { paymentStatus: { in: ["PENDING", "INPROGRESS"] } } }),
      prisma.selcomCollection.findMany({
        where: statusFilter === "ALL" ? {} : { paymentStatus: statusFilter },
        orderBy: [{ paidAt: { sort: "desc", nulls: "last" } }, { createdAt: "desc" }],
        take: 100,
      }),
      prisma.selcomCollection.groupBy({
        by: ["channel"],
        where: { paymentStatus: "COMPLETED", paidAt: { gte: monthStart } },
        _sum: { amount: true },
        _count: true,
      }),
      prisma.selcomCollection.findMany({
        where: { paymentStatus: "COMPLETED", paidAt: { gte: chartStart } },
        select: { paidAt: true, amount: true },
      }),
      prisma.integrationSyncRun.findFirst({
        where: { provider: "selcom" },
        orderBy: { startedAt: "desc" },
      }),
      prisma.selcomCollection.findFirst({
        where: { paymentStatus: "COMPLETED" },
        orderBy: { paidAt: "desc" },
        select: { paidAt: true },
      }),
    ]);

  // Bucket completed payments into EAT calendar days for the chart.
  const points: DailyPoint[] = Array.from({ length: 14 }, (_, i) => {
    const start = new Date(chartStart.getTime() + i * DAY);
    return {
      label: start.toLocaleDateString("en-GB", { timeZone: "Africa/Dar_es_Salaam", day: "2-digit", month: "short" }),
      amount: 0,
      count: 0,
    };
  });
  for (const row of chartRows) {
    if (!row.paidAt) continue;
    const i = Math.floor((row.paidAt.getTime() - chartStart.getTime()) / DAY);
    if (i >= 0 && i < 14) {
      points[i].amount += Number(row.amount ?? 0);
      points[i].count += 1;
    }
  }

  const configured = Boolean(getSelcomConfig());
  const channels = byChannel
    .map((c) => ({ channel: c.channel ?? "Unknown", amount: Number(c._sum.amount ?? 0), count: c._count }))
    .sort((a, b) => b.amount - a.amount);
  const filters = ["ALL", "COMPLETED", "PENDING", "CANCELLED", "REJECTED"];

  return (
    <div className="space-y-6">
      <AutoRefresh seconds={15} />
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h1 className="text-2xl font-heading font-bold">Collections</h1>
          <p className="text-sm text-muted-foreground">
            Live payments received through Selcom. Updates every 15 seconds.
            {lastPayment?.paidAt && <> Last payment {fmtRelative(lastPayment.paidAt, now)}.</>}
          </p>
        </div>
        <Badge tone={configured ? "success" : "warning"}>
          {configured ? "Selcom connected" : "Selcom not configured"}
        </Badge>
      </div>

      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <Stat label="Today" value={formatTzs(todayTotals.amount)} sub={`${todayTotals.count} payments`} />
        <Stat label="Last 7 days" value={formatTzs(weekTotals.amount)} sub={`${weekTotals.count} payments`} />
        <Stat label="This month" value={formatTzs(monthTotals.amount)} sub={`${monthTotals.count} payments`} />
        <Stat label="Awaiting confirmation" value={String(pendingCount)} sub="Pending or in progress" />
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold mb-4">Collected per day, last 14 days (TZS)</h2>
          <DailyBars points={points} />
        </section>
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold mb-3">By channel, this month</h2>
          {channels.length === 0 ? (
            <p className="text-sm text-muted-foreground">No completed payments this month yet.</p>
          ) : (
            <table className="w-full text-sm">
              <tbody>
                {channels.map((c) => (
                  <tr key={c.channel} className="border-b border-border last:border-0">
                    <td className="py-2">{c.channel}</td>
                    <td className="py-2 text-right text-muted-foreground">{c.count}</td>
                    <td className="py-2 text-right font-tabular">{formatTzs(c.amount)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </div>

      {canSync && (
        <section className="rounded-lg border border-border bg-surface p-5 space-y-3">
          <h2 className="text-sm font-semibold">Selcom sync</h2>
          <p className="text-sm text-muted-foreground text-justify">
            Payments arrive instantly through the webhook. A sync also pulls Selcom&apos;s own order
            list, which catches anything the webhook missed and imports past orders.
            {lastRun && (
              <>
                {" "}Last sync {fmtRelative(lastRun.startedAt, now)} ({lastRun.trigger}):{" "}
                <span className={lastRun.status === "failed" ? "text-status-danger" : ""}>
                  {lastRun.status === "failed" ? `failed, ${lastRun.error}` : `${lastRun.upserted} orders`}
                </span>
                .
              </>
            )}
          </p>
          {configured ? (
            <SyncForm />
          ) : (
            <p className="text-sm text-status-warning">
              Set SELCOM_API_KEY and SELCOM_API_SECRET in the deployment environment to enable syncing.
            </p>
          )}
        </section>
      )}

      <section>
        <div className="flex flex-wrap items-center justify-between gap-2 mb-3">
          <h2 className="text-sm font-semibold">Latest orders</h2>
          <div className="flex flex-wrap gap-1">
            {filters.map((f) => (
              <Link
                key={f}
                href={f === "ALL" ? "/finance/collections" : `/finance/collections?status=${f.toLowerCase()}`}
                className={`rounded-full px-3 py-1 text-xs border ${statusFilter === f ? "bg-primary text-primary-foreground border-primary" : "border-border bg-surface hover:bg-background"}`}
              >
                {f === "ALL" ? "All" : f.charAt(0) + f.slice(1).toLowerCase()}
              </Link>
            ))}
          </div>
        </div>
        {recent.length === 0 ? (
          <EmptyState
            icon={Wallet}
            title="No Selcom orders yet"
            description={
              configured
                ? "Run a sync above, or wait for the next payment to arrive through the webhook."
                : "Connect Selcom (see README, Selcom collections) to start receiving payments here."
            }
          />
        ) : (
          <div className="overflow-x-auto rounded-lg border border-border bg-surface">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                  <th className="px-4 py-3 font-medium">Paid / created</th>
                  <th className="px-4 py-3 font-medium">Order</th>
                  <th className="px-4 py-3 font-medium">Channel</th>
                  <th className="px-4 py-3 font-medium">Payer</th>
                  <th className="px-4 py-3 font-medium text-right">Amount</th>
                  <th className="px-4 py-3 font-medium">Status</th>
                </tr>
              </thead>
              <tbody>
                {recent.map((r) => (
                  <tr key={r.id} className="border-b border-border last:border-0">
                    <td className="px-4 py-2.5 whitespace-nowrap">
                      {fmtDateTime(r.paidAt ?? r.orderCreatedAt ?? r.createdAt)}
                    </td>
                    <td className="px-4 py-2.5">
                      <p className="font-tabular text-xs">{r.orderId}</p>
                      {r.transId && <p className="text-xs text-muted-foreground">Txn {r.transId}</p>}
                    </td>
                    <td className="px-4 py-2.5">{r.channel ?? ""}</td>
                    <td className="px-4 py-2.5 font-tabular text-xs">{r.msisdn ?? ""}</td>
                    <td className="px-4 py-2.5 text-right font-tabular whitespace-nowrap">
                      {r.amount !== null ? formatTzs(Number(r.amount)) : ""}
                    </td>
                    <td className="px-4 py-2.5">
                      <Badge tone={statusTone(r.paymentStatus)}>{r.paymentStatus.toLowerCase()}</Badge>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
