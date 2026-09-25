import Link from "next/link";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserPermissions } from "@/lib/permissions";
import { collectedSince, formatTzs, startOfEatDay } from "@/lib/integrations/selcom";
import { isBoardMember } from "@/lib/boardroom/members";
import { pendingAgreementsFor } from "@/lib/boardroom/agreements";
import { parseElectorate } from "@/lib/boardroom/decisions";
import { fmtDateTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { AutoRefresh } from "@/components/ui/AutoRefresh";
import {
  Landmark,
  Boxes,
  ClipboardCheck,
  FolderKanban,
  Users,
} from "lucide-react";

const SECTIONS = [
  {
    module: "finance" as const,
    icon: Landmark,
    title: "Revenue & cash position",
    description:
      "Gross vs net revenue, Stanbic cash position, and the directors' loan balance will appear here once banking and subscriber-revenue data is imported (Phase 4).",
  },
  {
    module: "assets" as const,
    icon: Boxes,
    title: "Fixed asset base",
    description:
      "Net book value and device status counts will appear here once the fixed asset register is built and seeded (Phase 4).",
  },
  {
    module: "approvals" as const,
    icon: ClipboardCheck,
    title: "Approvals awaiting you",
    description:
      "Payments, purchases, and payroll runs awaiting your decision will appear here once the approval engine is built (Phase 4).",
  },
  {
    module: "projects" as const,
    icon: FolderKanban,
    title: "Active sites & rollout",
    description:
      "SAUT campus and off-campus site rollout progress will appear here once the Projects module is built (Phase 4).",
  },
  {
    module: "hr" as const,
    icon: Users,
    title: "Payroll & headcount",
    description:
      "Current payroll run status and headcount will appear here once the HR/Payroll module is built (Phase 4).",
  },
];

export default async function DashboardPage() {
  const session = await auth();
  const grants = session?.user ? await getUserPermissions(session.user.id) : new Set<string>();
  const firstName = session?.user?.name?.split(" ")[0] ?? "there";

  const visibleSections = SECTIONS.filter((s) => grants.has(`${s.module}:view`));
  const userId = session?.user?.id;
  const showCollections = grants.has("banking:view") || grants.has("sales_subscriber:view");
  const board = userId ? await isBoardMember(userId) : false;

  const [today, month, toSign, openDecisions, nextMeeting] = await Promise.all([
    showCollections ? collectedSince(startOfEatDay()) : null,
    showCollections ? collectedSince(new Date(startOfEatDay().getTime() - 29 * 24 * 60 * 60 * 1000)) : null,
    board && userId ? pendingAgreementsFor(userId) : [],
    board ? prisma.decision.findMany({ where: { status: "open" }, include: { votes: { select: { userId: true } } } }) : [],
    userId
      ? prisma.meeting.findFirst({
          where: { status: "scheduled", scheduledAt: { gte: new Date(new Date().getTime() - 60 * 60 * 1000) }, invitees: { some: { userId } } },
          orderBy: { scheduledAt: "asc" },
        })
      : null,
  ]);
  const awaitingVote = openDecisions.filter(
    (d) => parseElectorate(d.electorate).some((e) => e.userId === userId) && !d.votes.some((v) => v.userId === userId),
  );
  const actionCards = [
    today && {
      href: "/finance/collections",
      label: "Collected today (Selcom)",
      value: formatTzs(today.amount),
      sub: `${today.count} payments · ${formatTzs(month?.amount ?? 0)} in the last 30 days`,
    },
    board && {
      href: "/boardroom/decisions",
      label: "Decisions awaiting your vote",
      value: String(awaitingVote.length),
      sub: `${openDecisions.length} open in total`,
    },
    board && {
      href: "/boardroom/agreements",
      label: "Agreements to sign",
      value: String(toSign.length),
      sub: toSign.length ? toSign.map((a) => a.title).join(", ") : "All signed",
    },
    nextMeeting && {
      href: `/meetings/${nextMeeting.id}`,
      label: "Next meeting",
      value: nextMeeting.title,
      sub: `${fmtDateTime(nextMeeting.scheduledAt)} EAT`,
    },
  ].filter(Boolean) as { href: string; label: string; value: string; sub: string }[];

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold mb-1">
        Welcome back, {firstName}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        Live collections, board business and meetings are below. Other
        business modules land in later phases.
      </p>

      {showCollections && <AutoRefresh seconds={30} />}
      {actionCards.length > 0 && (
        <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-3 mb-6">
          {actionCards.map((c) => (
            <Link key={c.href} href={c.href} className="rounded-lg border border-border bg-surface p-4 hover:border-accent min-w-0">
              <p className="text-xs uppercase tracking-wider text-muted-foreground">{c.label}</p>
              <p className="mt-1 text-xl font-semibold font-tabular truncate">{c.value}</p>
              <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">{c.sub}</p>
            </Link>
          ))}
        </div>
      )}

      {visibleSections.length === 0 ? (
        <EmptyState
          icon={ClipboardCheck}
          title="No dashboard sections available"
          description="Your account doesn't currently hold a role with dashboard-visible permissions. Ask a Director to review your access under Settings → Users & Access."
        />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {visibleSections.map((s) => (
            <EmptyState
              key={s.title}
              icon={s.icon}
              title={s.title}
              description={s.description}
            />
          ))}
        </div>
      )}
    </div>
  );
}
