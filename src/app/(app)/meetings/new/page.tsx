import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { isBoardMember } from "@/lib/boardroom/members";
import { MeetingForm } from "@/components/meetings/MeetingForm";

export default async function NewMeetingPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [people, board] = await Promise.all([
    prisma.user.findMany({
      where: { isActive: true, id: { not: session.user.id } },
      select: { id: true, name: true },
      orderBy: { name: "asc" },
    }),
    isBoardMember(session.user.id),
  ]);
  // Default: tomorrow 10:00 EAT.
  const tomorrow = new Date(new Date().getTime() + 3 * 60 * 60 * 1000 + 24 * 60 * 60 * 1000);
  const defaultStart = `${tomorrow.toISOString().slice(0, 10)}T10:00`;

  return (
    <div className="max-w-3xl space-y-4">
      <h1 className="text-2xl font-heading font-bold">Schedule a meeting</h1>
      <section className="rounded-lg border border-border bg-surface p-5">
        <MeetingForm people={people} canCallBoardMeetings={board} defaultStart={defaultStart} />
      </section>
    </div>
  );
}
