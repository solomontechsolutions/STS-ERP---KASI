import Link from "next/link";
import { redirect } from "next/navigation";
import { Video } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { MEETING_KIND_LABELS, meetingWindow } from "@/lib/meetings";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";

export default async function MeetingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const userId = session.user.id;
  const now = new Date();

  const meetings = await prisma.meeting.findMany({
    where: { OR: [{ createdById: userId }, { invitees: { some: { userId } } }] },
    include: { _count: { select: { invitees: true } }, createdBy: { select: { name: true } } },
    orderBy: { scheduledAt: "desc" },
    take: 100,
  });

  const isUpcoming = (m: (typeof meetings)[number]) =>
    m.status === "scheduled" && meetingWindow(m).endsAt > now;
  const upcoming = meetings.filter(isUpcoming).reverse();
  const past = meetings.filter((m) => !isUpcoming(m));

  const Row = ({ m }: { m: (typeof meetings)[number] }) => {
    const { opensAt, endsAt } = meetingWindow(m);
    const live = m.status === "scheduled" && now >= opensAt && now <= endsAt;
    return (
      <li className="flex flex-wrap items-center justify-between gap-3 px-4 py-3">
        <div className="min-w-0">
          <Link href={`/meetings/${m.id}`} className="text-sm font-medium text-primary hover:underline">{m.title}</Link>
          <p className="text-xs text-muted-foreground">
            {MEETING_KIND_LABELS[m.kind] ?? m.kind} · {fmtDateTime(m.scheduledAt)} EAT · {m.durationMinutes} min ·{" "}
            {m._count.invitees} invited · by {m.createdBy.name}
          </p>
        </div>
        {live ? (
          <Link href={`/meetings/${m.id}`} className="inline-flex items-center gap-1.5 rounded-md bg-status-success px-3 py-1.5 text-xs font-medium text-white">
            <Video className="h-3.5 w-3.5" /> Join now
          </Link>
        ) : m.status === "scheduled" ? (
          <span className="text-xs text-muted-foreground">{fmtRelative(m.scheduledAt, now)}</span>
        ) : (
          <Badge tone={statusTone(m.status)}>{m.minutes ? "minuted" : m.status}</Badge>
        )}
      </li>
    );
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Meetings</h1>
          <p className="text-sm text-muted-foreground">Video meetings inside KASI, on phone or computer.</p>
        </div>
        <Link href="/meetings/new" className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90">
          Schedule a meeting
        </Link>
      </div>

      <section>
        <h2 className="text-sm font-semibold mb-2">Upcoming</h2>
        {upcoming.length === 0 ? (
          <EmptyState icon={Video} title="No upcoming meetings" description="Meetings you organise or are invited to will appear here." />
        ) : (
          <ul className="rounded-lg border border-border bg-surface divide-y divide-border">
            {upcoming.map((m) => <Row key={m.id} m={m} />)}
          </ul>
        )}
      </section>

      {past.length > 0 && (
        <section>
          <h2 className="text-sm font-semibold mb-2">Past and cancelled</h2>
          <ul className="rounded-lg border border-border bg-surface divide-y divide-border">
            {past.map((m) => <Row key={m.id} m={m} />)}
          </ul>
        </section>
      )}
    </div>
  );
}
