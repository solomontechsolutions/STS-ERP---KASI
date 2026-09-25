import Link from "next/link";
import { redirect } from "next/navigation";
import { Gavel } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAdministerBoardroom, getBoardMember } from "@/lib/boardroom/members";
import { CATEGORY_LABELS, parseElectorate, settleExpiredDecisions } from "@/lib/boardroom/decisions";
import { fmtDate, fmtRelative } from "@/lib/format";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default async function DecisionsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  await settleExpiredDecisions();

  const [decisions, me] = await Promise.all([
    prisma.decision.findMany({
      include: { votes: { select: { userId: true } }, proposedBy: { select: { name: true } } },
      orderBy: [{ createdAt: "desc" }],
      take: 200,
    }),
    getBoardMember(session.user.id),
  ]);
  const now = new Date();

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Decisions &amp; votes</h1>
          <p className="text-sm text-muted-foreground">
            Every decision of the company, who proposed it, how each founder voted and the outcome.
          </p>
        </div>
        {canAdministerBoardroom(me) && (
          <Link href="/boardroom/decisions/new" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
            Table a decision
          </Link>
        )}
      </div>

      {decisions.length === 0 ? (
        <EmptyState icon={Gavel} title="No decisions yet" description="Decisions tabled by the board will be listed here." />
      ) : (
        <ul className="rounded-lg border border-border bg-surface divide-y divide-border">
          {decisions.map((d) => {
            const electorate = parseElectorate(d.electorate);
            const needsMe =
              d.status === "open" &&
              electorate.some((e) => e.userId === session.user.id) &&
              !d.votes.some((v) => v.userId === session.user.id);
            return (
              <li key={d.id} className="px-4 py-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-tabular text-xs text-muted-foreground">{d.reference}</span>
                  <Badge tone={statusTone(d.status)}>{d.status}</Badge>
                  {needsMe && <Badge tone="warning">Your vote needed</Badge>}
                </div>
                <Link href={`/boardroom/decisions/${d.id}`} className="mt-1 block text-sm font-medium text-primary hover:underline">
                  {d.title}
                </Link>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {CATEGORY_LABELS[d.category] ?? d.category} · proposed by {d.proposedBy.name} on {fmtDate(d.createdAt)} ·{" "}
                  {d.votes.length} of {electorate.length} voted ·{" "}
                  {d.status === "open" ? `closes ${fmtRelative(d.closesAt, now)}` : `closed ${fmtDate(d.closedAt)}`}
                </p>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
