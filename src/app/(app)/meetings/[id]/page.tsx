import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { Lock, ShieldAlert } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getBoardMember } from "@/lib/boardroom/members";
import {
  MEETING_KIND_LABELS,
  canAccessMeeting,
  getMeetingProvider,
  isBoardMeetingKind,
  meetingWindow,
  signMeetingToken,
} from "@/lib/meetings";
import { cancelMeetingAction, endMeetingAction } from "@/lib/actions/meetings";
import { fmtDateTime, fmtTime } from "@/lib/format";
import { Badge, statusTone } from "@/components/ui/badge";
import { EmptyState } from "@/components/ui/empty-state";
import { MeetingRoom } from "@/components/meetings/MeetingRoom";
import { MinutesForm } from "@/components/meetings/MinutesForm";
import { PrintButton } from "@/components/ui/PrintButton";

export default async function MeetingPage({ params }: PageProps<"/meetings/[id]">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  if (!(await canAccessMeeting(session.user.id, id))) {
    const exists = await prisma.meeting.count({ where: { id } });
    if (!exists) notFound();
    return <EmptyState icon={Lock} title="Not invited" description="Only people invited to this meeting can open it." />;
  }

  const [meeting, me] = await Promise.all([
    prisma.meeting.findUniqueOrThrow({
      where: { id },
      include: {
        invitees: { include: { user: { select: { id: true, name: true, email: true } } } },
        createdBy: { select: { name: true } },
        decisions: { select: { id: true, reference: true, title: true, status: true } },
      },
    }),
    getBoardMember(session.user.id),
  ]);

  const now = new Date();
  const { opensAt, endsAt } = meetingWindow(meeting);
  const joinable = meeting.status === "scheduled" && now >= opensAt && now <= endsAt;
  const isOrganiser =
    meeting.createdById === session.user.id ||
    (isBoardMeetingKind(meeting.kind) && Boolean(me?.isCompanySecretary));

  const provider = getMeetingProvider();
  const self = meeting.invitees.find((i) => i.userId === session.user.id)?.user;
  const jwt = joinable
    ? signMeetingToken(
        provider,
        meeting.roomName,
        {
          id: session.user.id,
          name: self?.name ?? session.user.name ?? "KASI user",
          email: self?.email ?? session.user.email ?? "",
          moderator: isOrganiser,
        },
        Math.ceil((endsAt.getTime() - now.getTime()) / 1000) + 3600,
      )
    : null;

  return (
    <div className="max-w-5xl space-y-6">
      <Link href="/meetings" className="text-sm text-primary hover:underline print:hidden">Meetings</Link>

      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Badge tone="info">{MEETING_KIND_LABELS[meeting.kind] ?? meeting.kind}</Badge>
            <Badge tone={statusTone(meeting.status)}>{meeting.status}</Badge>
          </div>
          <h1 className="mt-1 text-2xl font-heading font-bold">{meeting.title}</h1>
          <p className="text-sm text-muted-foreground">
            {fmtDateTime(meeting.scheduledAt)} EAT · {meeting.durationMinutes} minutes · organised by {meeting.createdBy.name}
          </p>
        </div>
        {isOrganiser && meeting.status === "scheduled" && (
          <div className="flex gap-2 print:hidden">
            <form action={endMeetingAction.bind(null, meeting.id)}>
              <button type="submit" className="rounded-md border border-border bg-surface px-3 py-1.5 text-sm hover:bg-background">Mark as ended</button>
            </form>
            <form action={cancelMeetingAction.bind(null, meeting.id)}>
              <button type="submit" className="rounded-md px-3 py-1.5 text-sm text-status-danger hover:bg-status-danger/10">Cancel meeting</button>
            </form>
          </div>
        )}
      </div>

      {meeting.status === "scheduled" && (
        <section className="print:hidden">
          {joinable ? (
            <>
              {!provider.secured && isBoardMeetingKind(meeting.kind) && (
                <p className="mb-3 flex items-start gap-2 rounded-md bg-status-warning/10 px-3 py-2 text-sm text-status-warning">
                  <ShieldAlert className="h-4 w-4 mt-0.5 shrink-0" />
                  <span className="text-justify">
                    The meeting server is running without token security, so the room is protected
                    only by its secret name. Configure 8x8 JaaS or a self-hosted Jitsi with tokens
                    before discussing confidential board business.
                  </span>
                </p>
              )}
              <MeetingRoom
                meetingId={meeting.id}
                domain={provider.domain}
                scriptUrl={provider.scriptUrl}
                roomName={provider.roomFor(meeting.roomName)}
                jwt={jwt}
                displayName={self?.name ?? session.user.name ?? "KASI user"}
                email={self?.email ?? session.user.email ?? ""}
                subject={meeting.title}
              />
            </>
          ) : (
            <p className="rounded-lg border border-border bg-surface p-5 text-sm text-muted-foreground">
              {now < opensAt
                ? `The room opens at ${fmtTime(opensAt)} EAT, 15 minutes before the start. Everyone invited gets a reminder notification.`
                : "The room has closed."}
            </p>
          )}
        </section>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 rounded-lg border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold mb-2">Agenda</h2>
          <p className="text-sm whitespace-pre-wrap text-justify">{meeting.agenda}</p>
          {meeting.decisions.length > 0 && (
            <>
              <h3 className="text-sm font-semibold mt-4 mb-1">Decisions linked to this meeting</h3>
              <ul className="text-sm space-y-1">
                {meeting.decisions.map((d) => (
                  <li key={d.id}>
                    <Link href={`/boardroom/decisions/${d.id}`} className="text-primary hover:underline">{d.reference}: {d.title}</Link>{" "}
                    <Badge tone={statusTone(d.status)}>{d.status}</Badge>
                  </li>
                ))}
              </ul>
            </>
          )}
        </section>
        <section className="rounded-lg border border-border bg-surface p-5">
          <h2 className="text-sm font-semibold mb-2">Attendance</h2>
          <ul className="text-sm divide-y divide-border">
            {meeting.invitees.map((i) => (
              <li key={i.id} className="flex justify-between gap-2 py-1.5">
                <span>{i.user.name}</span>
                <span className={`text-xs ${i.joinedAt ? "text-status-success" : "text-muted-foreground"}`}>
                  {i.joinedAt ? `joined ${fmtTime(i.joinedAt)}` : "not joined"}
                </span>
              </li>
            ))}
          </ul>
        </section>
      </div>

      <section className="rounded-lg border border-border bg-surface p-5">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold">Minutes</h2>
          {meeting.minutes && <div className="print:hidden"><PrintButton label="Print minutes" /></div>}
        </div>
        {meeting.minutes && (
          <>
            <p className="text-xs text-muted-foreground mb-2">Recorded {fmtDateTime(meeting.minutesAt)} EAT</p>
            <p className="text-sm whitespace-pre-wrap text-justify">{meeting.minutes}</p>
          </>
        )}
        {isOrganiser ? (
          <div className="mt-4 print:hidden">
            <MinutesForm meetingId={meeting.id} initial={meeting.minutes ?? ""} />
          </div>
        ) : (
          !meeting.minutes && <p className="text-sm text-muted-foreground">The organiser has not recorded minutes yet.</p>
        )}
      </section>
    </div>
  );
}
