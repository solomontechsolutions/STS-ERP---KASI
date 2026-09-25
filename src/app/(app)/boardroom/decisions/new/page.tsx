import { redirect } from "next/navigation";
import { Gavel } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAdministerBoardroom, getBoardMember, listBoardMembers } from "@/lib/boardroom/members";
import { buildElectorate } from "@/lib/boardroom/decisions";
import { fmtDateTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { DecisionForm } from "@/components/boardroom/DecisionForm";

/** yyyy-MM-ddTHH:mm in EAT, for a datetime-local default. */
function eatLocalInput(date: Date) {
  return new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 16);
}

export default async function NewDecisionPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!canAdministerBoardroom(await getBoardMember(session.user.id))) {
    return (
      <EmptyState icon={Gavel} title="Not allowed" description="Only directors or the Company Secretary can table a decision." />
    );
  }

  const [members, meetings] = await Promise.all([
    listBoardMembers(),
    prisma.meeting.findMany({
      where: { kind: { in: ["board", "shareholders"] }, status: { not: "cancelled" } },
      orderBy: { scheduledAt: "desc" },
      take: 20,
      select: { id: true, title: true, scheduledAt: true },
    }),
  ]);
  const strip = (e: { name: string; weight: number }[]) => e.map(({ name, weight }) => ({ name, weight }));

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-heading font-bold">Table a decision</h1>
      <section className="rounded-lg border border-border bg-surface p-5">
        <DecisionForm
          directors={strip(buildElectorate(members, "per_director"))}
          shareholders={strip(buildElectorate(members, "shareholding"))}
          meetings={meetings.map((m) => ({ id: m.id, label: `${m.title} (${fmtDateTime(m.scheduledAt)})` }))}
          defaultClosesAt={eatLocalInput(new Date(new Date().getTime() + 3 * 24 * 60 * 60 * 1000))}
        />
      </section>
    </div>
  );
}
