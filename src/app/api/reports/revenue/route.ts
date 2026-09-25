import { auth } from "@/auth";
import { userHasPermission } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { revenueReport } from "@/lib/integrations/selcom";
import { resolvePeriod } from "@/lib/report-period";

/** CSV of the revenue report (daily rows, then channels) for Excel. */
export async function GET(request: Request) {
  const session = await auth();
  if (!session?.user) return new Response("Unauthorized", { status: 401 });
  const allowed =
    (await userHasPermission(session.user.id, "banking", "export")) ||
    (await userHasPermission(session.user.id, "sales_subscriber", "export"));
  if (!allowed) return new Response("Forbidden", { status: 403 });

  const url = new URL(request.url);
  const period = resolvePeriod(Object.fromEntries(url.searchParams));
  const report = await revenueReport(period.from, period.toExclusive);

  const lines = [
    `Revenue report (Selcom),${period.fromKey} to ${period.toKey}`,
    "",
    "Date,Payments,Revenue (TZS)",
    ...report.days.map((d) => `${d.date},${d.count},${d.amount.toFixed(2)}`),
    `Total,${report.count},${report.total.toFixed(2)}`,
    "",
    "Channel,Payments,Revenue (TZS),Share",
    ...report.channels.map(
      (c) => `"${c.channel.replace(/"/g, '""')}",${c.count},${c.amount.toFixed(2)},${(c.share * 100).toFixed(1)}%`,
    ),
  ];

  await recordAudit({
    entityType: "report",
    entityId: "revenue",
    action: "export",
    actorId: session.user.id,
    afterData: { from: period.fromKey, to: period.toKey },
  });

  return new Response(lines.join("\r\n"), {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="kasi-revenue-${period.fromKey}-to-${period.toKey}.csv"`,
      "Cache-Control": "no-store",
    },
  });
}
