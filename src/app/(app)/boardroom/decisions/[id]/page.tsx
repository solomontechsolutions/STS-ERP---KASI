import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  BASIS_LABELS,
  CATEGORY_LABELS,
  THRESHOLD_LABELS,
  fmtWeight,
  parseElectorate,
  settleDecision,
  tally,
  type Threshold,
  type VotingBasis,
} from "@/lib/boardroom/decisions";
import { withdrawDecisionAction } from "@/lib/actions/decisions";
import { fmtDateTime, fmtRelative } from "@/lib/format";
import { Badge, statusTone } from "@/components/ui/badge";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import { VoteForm } from "@/components/boardroom/VoteForm";
import { CommentForm } from "@/components/boardroom/CommentForm";

const CHOICE_TONE = { for: "success", against: "danger", abstain: "neutral" } as const;

export default async function DecisionPage({ params }: PageProps<"/boardroom/decisions/[id]">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  await settleDecision(id);
  const decision = await prisma.decision.findUnique({
    where: { id },
    include: {
      votes: { orderBy: { castAt: "asc" } },
      comments: { include: { user: { select: { name: true } } }, orderBy: { createdAt: "asc" } },
      proposedBy: { select: { name: true } },
      meeting: { select: { id: true, title: true } },
    },
  });
  if (!decision) notFound();

  const electorate = parseElectorate(decision.electorate);
  const result = tally(electorate, decision.votes, decision.threshold);
  const basis = decision.votingBasis as VotingBasis;
  const me = electorate.find((e) => e.userId === session.user.id);
  const myVote = decision.votes.find((v) => v.userId === session.user.id);
  const isOpen = decision.status === "open";
  const pct = (w: number) => (result.total > 0 ? (w / result.total) * 100 : 0);

  return (
    <div className="max-w-4xl space-y-6">
      {isOpen && <AutoRefresh seconds={20} />}
      <Link href="/boardroom/decisions" className="text-sm text-primary hover:underline">Decisions &amp; votes</Link>

      <div>
        <div className="flex flex-wrap items-center gap-2">
          <span className="font-tabular text-sm text-muted-foreground">{decision.reference}</span>
          <Badge tone={statusTone(decision.status)}>{decision.status}</Badge>
        </div>
        <h1 className="mt-1 text-2xl font-heading font-bold">{decision.title}</h1>
        <p className="text-sm text-muted-foreground mt-1">
          {CATEGORY_LABELS[decision.category]} · {BASIS_LABELS[basis]} ·{" "}
          {THRESHOLD_LABELS[decision.threshold as Threshold]} · proposed by {decision.proposedBy.name}{" "}
          on {fmtDateTime(decision.createdAt)}
          {decision.meeting && (
            <> · from <Link href={`/meetings/${decision.meeting.id}`} className="text-primary hover:underline">{decision.meeting.title}</Link></>
          )}
        </p>
      </div>

      {decision.outcomeNote && (
        <p className={`rounded-md px-4 py-3 text-sm ${decision.status === "passed" ? "bg-status-success/10 text-status-success" : "bg-background text-foreground border border-border"}`}>
          {decision.outcomeNote}
        </p>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <section className="lg:col-span-2 rounded-lg border border-border bg-surface p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold mb-1">Background</h2>
            <p className="text-sm whitespace-pre-wrap text-justify">{decision.background}</p>
          </div>
          <div>
            <h2 className="text-sm font-semibold mb-1">Resolution</h2>
            <p className="text-sm whitespace-pre-wrap text-justify">{decision.proposedAction}</p>
          </div>
        </section>

        <section className="rounded-lg border border-border bg-surface p-5 space-y-4">
          <div>
            <h2 className="text-sm font-semibold">Tally</h2>
            <p className="text-xs text-muted-foreground">
              Needs {fmtWeight(result.requiredWeight, basis)} in favour
              {decision.threshold === "simple_majority" ? " (more than half)" : ""} of{" "}
              {fmtWeight(result.total, basis)}.
            </p>
          </div>
          {/* Stacked bar: for / against / abstain / not yet voted, 2px gaps. */}
          <div className="relative">
            <div className="flex h-3 w-full gap-[2px] overflow-hidden rounded-full bg-background">
              {[
                { w: result.forWeight, c: "bg-status-success" },
                { w: result.againstWeight, c: "bg-status-danger" },
                { w: result.abstainWeight, c: "bg-muted-foreground" },
              ].map((s, i) => (s.w > 0 ? <div key={i} className={s.c} style={{ width: `${pct(s.w)}%` }} /> : null))}
            </div>
            <div
              className="absolute -top-1 h-5 w-[2px] bg-foreground"
              style={{ left: `${Math.min(100, (result.requiredWeight / (result.total || 1)) * 100)}%` }}
              title="Required to pass"
            />
          </div>
          <dl className="text-sm space-y-1">
            <div className="flex justify-between"><dt className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-status-success" />For</dt><dd className="font-tabular">{fmtWeight(result.forWeight, basis)}</dd></div>
            <div className="flex justify-between"><dt className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-status-danger" />Against</dt><dd className="font-tabular">{fmtWeight(result.againstWeight, basis)}</dd></div>
            <div className="flex justify-between"><dt className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-muted-foreground" />Abstain</dt><dd className="font-tabular">{fmtWeight(result.abstainWeight, basis)}</dd></div>
            <div className="flex justify-between text-muted-foreground"><dt className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full border border-border" />Not yet voted</dt><dd className="font-tabular">{fmtWeight(result.outstanding, basis)}</dd></div>
          </dl>
          <p className="text-xs text-muted-foreground">
            {isOpen ? `Closes ${fmtDateTime(decision.closesAt)} EAT (${fmtRelative(decision.closesAt)}).` : `Closed ${fmtDateTime(decision.closedAt)} EAT.`}
          </p>
        </section>
      </div>

      {isOpen && me && !myVote && (
        <section className="rounded-lg border-2 border-accent bg-surface p-5">
          <VoteForm decisionId={decision.id} weightLabel={fmtWeight(me.weight, basis)} />
        </section>
      )}
      {myVote && (
        <p className="rounded-md bg-status-success/10 px-4 py-3 text-sm text-status-success">
          You voted <strong>{myVote.choice}</strong> on {fmtDateTime(myVote.castAt)} EAT
          ({fmtWeight(Number(myVote.weight), basis)}). Votes are final.
        </p>
      )}
      {isOpen && !me && (
        <p className="text-sm text-muted-foreground">
          You can follow this decision but are not in its electorate ({BASIS_LABELS[basis].toLowerCase()}).
        </p>
      )}

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold mb-3">Votes</h2>
        <ul className="divide-y divide-border text-sm">
          {electorate.map((e) => {
            const v = decision.votes.find((x) => x.userId === e.userId);
            return (
              <li key={e.userId} className="flex flex-wrap items-center justify-between gap-2 py-2">
                <span>
                  {e.name} <span className="text-xs text-muted-foreground">({fmtWeight(e.weight, basis)})</span>
                </span>
                {v ? (
                  <span className="flex items-center gap-2">
                    <Badge tone={CHOICE_TONE[v.choice as keyof typeof CHOICE_TONE] ?? "neutral"}>{v.choice}</Badge>
                    <span className="text-xs text-muted-foreground">{fmtDateTime(v.castAt)}</span>
                  </span>
                ) : (
                  <span className="text-xs text-muted-foreground">{isOpen ? "Awaiting vote" : "Did not vote"}</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      <section className="rounded-lg border border-border bg-surface p-5 space-y-4">
        <h2 className="text-sm font-semibold">Discussion</h2>
        {decision.comments.length === 0 ? (
          <p className="text-sm text-muted-foreground">No comments yet.</p>
        ) : (
          <ul className="space-y-3">
            {decision.comments.map((c) => (
              <li key={c.id} className="rounded-md bg-background p-3">
                <p className="text-xs text-muted-foreground">
                  <span className="font-medium text-foreground">{c.user.name}</span> · {fmtDateTime(c.createdAt)}
                </p>
                <p className="text-sm whitespace-pre-wrap mt-1 text-justify">{c.body}</p>
              </li>
            ))}
          </ul>
        )}
        <CommentForm decisionId={decision.id} />
      </section>

      {isOpen && decision.proposedById === session.user.id && decision.votes.length === 0 && (
        <form action={withdrawDecisionAction.bind(null, decision.id)}>
          <button type="submit" className="text-sm text-status-danger hover:underline">
            Withdraw this decision
          </button>
        </form>
      )}
    </div>
  );
}
