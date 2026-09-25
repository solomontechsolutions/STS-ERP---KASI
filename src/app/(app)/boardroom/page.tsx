import Link from "next/link";
import { redirect } from "next/navigation";
import { CalendarClock, FileSignature, Gavel, Video } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { listBoardMembers } from "@/lib/boardroom/members";
import { getSignatureMatrix } from "@/lib/boardroom/agreements";
import { parseElectorate, settleExpiredDecisions } from "@/lib/boardroom/decisions";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export default async function BoardroomPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;

  // Close anything past its deadline so the counts below are current even
  // when no scheduler is running.
  await settleExpiredDecisions();

  const now = new Date();
  const [members, matrix, openDecisions, upcoming] = await Promise.all([
    listBoardMembers(),
    getSignatureMatrix(),
    prisma.decision.findMany({
      where: { status: "open" },
      include: { votes: { select: { userId: true } } },
      orderBy: { closesAt: "asc" },
    }),
    prisma.meeting.findMany({
      where: {
        status: "scheduled",
        scheduledAt: { gte: new Date(now.getTime() - 3 * 60 * 60 * 1000) },
        invitees: { some: { userId } },
      },
      orderBy: { scheduledAt: "asc" },
      take: 5,
    }),
  ]);

  const myRow = matrix.rows.find((r) => r.member.userId === userId);
  const myPending = myRow ? myRow.cells.filter((c) => !c.signedAt).length : 0;
  const awaitingMyVote = openDecisions.filter(
    (d) =>
      parseElectorate(d.electorate).some((e) => e.userId === userId) &&
      !d.votes.some((v) => v.userId === userId),
  );
  const totalShares = members.reduce((n, m) => n + m.sharePercent, 0);

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-heading font-bold">Boardroom</h1>
        <p className="text-sm text-muted-foreground">
          Decisions, votes, founder agreements and meetings of Solomon Tech Solutions. Visible to
          all directors and shareholders.
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Link href="/boardroom/decisions" className="rounded-lg border border-border bg-surface p-4 hover:border-accent">
          <Gavel className="h-5 w-5 text-primary" />
          <p className="mt-2 text-2xl font-semibold">{awaitingMyVote.length}</p>
          <p className="text-sm text-muted-foreground">decision{awaitingMyVote.length === 1 ? "" : "s"} awaiting your vote</p>
        </Link>
        <Link href="/boardroom/agreements" className="rounded-lg border border-border bg-surface p-4 hover:border-accent">
          <FileSignature className="h-5 w-5 text-primary" />
          <p className="mt-2 text-2xl font-semibold">{myPending}</p>
          <p className="text-sm text-muted-foreground">agreement{myPending === 1 ? "" : "s"} for you to sign</p>
        </Link>
        <Link href="/meetings" className="rounded-lg border border-border bg-surface p-4 hover:border-accent">
          <CalendarClock className="h-5 w-5 text-primary" />
          <p className="mt-2 text-2xl font-semibold">{upcoming.length}</p>
          <p className="text-sm text-muted-foreground">upcoming meeting{upcoming.length === 1 ? "" : "s"}</p>
        </Link>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Open decisions</h2>
            <Link href="/boardroom/decisions/new" className="text-sm text-primary hover:underline">Table a decision</Link>
          </div>
          {openDecisions.length === 0 ? (
            <p className="text-sm text-muted-foreground">No decisions are open for voting.</p>
          ) : (
            <ul className="divide-y divide-border">
              {openDecisions.map((d) => {
                const electorate = parseElectorate(d.electorate);
                const mine = electorate.some((e) => e.userId === userId) && !d.votes.some((v) => v.userId === userId);
                return (
                  <li key={d.id} className="py-2.5">
                    <Link href={`/boardroom/decisions/${d.id}`} className="text-sm font-medium text-primary hover:underline">
                      {d.reference}: {d.title}
                    </Link>
                    <p className="text-xs text-muted-foreground mt-0.5 flex flex-wrap gap-2 items-center">
                      <span>{d.votes.length} of {electorate.length} voted</span>
                      <span>Closes {fmtRelative(d.closesAt, now)}</span>
                      {mine && <Badge tone="warning">Your vote needed</Badge>}
                    </p>
                  </li>
                );
              })}
            </ul>
          )}
        </section>

        <section className="rounded-lg border border-border bg-surface p-5">
          <div className="flex items-center justify-between mb-3">
            <h2 className="text-sm font-semibold">Your upcoming meetings</h2>
            <Link href="/meetings/new" className="text-sm text-primary hover:underline">Schedule</Link>
          </div>
          {upcoming.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nothing scheduled.</p>
          ) : (
            <ul className="divide-y divide-border">
              {upcoming.map((m) => (
                <li key={m.id} className="py-2.5 flex items-center justify-between gap-3">
                  <div className="min-w-0">
                    <Link href={`/meetings/${m.id}`} className="text-sm font-medium text-primary hover:underline">{m.title}</Link>
                    <p className="text-xs text-muted-foreground">{fmtDateTime(m.scheduledAt)} EAT</p>
                  </div>
                  <Link href={`/meetings/${m.id}`} className="inline-flex items-center gap-1 text-xs rounded-md border border-border px-2 py-1 hover:bg-background">
                    <Video className="h-3.5 w-3.5" /> Open
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
      </div>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold mb-3">Founders</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Name</th>
                <th className="py-2 pr-4 font-medium">Role</th>
                <th className="py-2 pr-4 font-medium text-right">Shareholding</th>
                <th className="py-2 font-medium text-right">Agreements signed</th>
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((r) => {
                const signed = r.cells.filter((c) => c.signedAt).length;
                return (
                  <tr key={r.member.userId} className="border-b border-border last:border-0">
                    <td className="py-2 pr-4">{r.member.name}</td>
                    <td className="py-2 pr-4 text-muted-foreground">
                      {[r.member.isDirector && "Director", r.member.isCompanySecretary && "Company Secretary", r.member.isShareholder && "Shareholder"].filter(Boolean).join(", ")}
                    </td>
                    <td className="py-2 pr-4 text-right font-tabular">{r.member.sharePercent}%</td>
                    <td className="py-2 text-right">
                      <Badge tone={signed === r.cells.length ? "success" : "warning"}>
                        {signed} / {r.cells.length}
                      </Badge>
                    </td>
                  </tr>
                );
              })}
            </tbody>
            <tfoot>
              <tr className="text-xs text-muted-foreground">
                <td className="pt-2" colSpan={2}>{members.length} founders</td>
                <td className="pt-2 text-right font-tabular">{totalShares}%</td>
                <td className="pt-2 text-right">{matrix.totalSigned} / {matrix.totalRequired}</td>
              </tr>
            </tfoot>
          </table>
        </div>
      </section>
    </div>
  );
}
