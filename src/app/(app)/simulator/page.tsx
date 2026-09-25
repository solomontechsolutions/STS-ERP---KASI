import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { getUserPermissions } from "@/lib/permissions";
import { isBoardMember } from "@/lib/boardroom/members";
import { NAV_GROUPS, canSeeNavItem } from "@/lib/nav";
import { DeviceSimulator } from "@/components/simulator/DeviceSimulator";

export default async function SimulatorPage({ searchParams }: PageProps<"/simulator">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const [grants, board, params] = await Promise.all([
    getUserPermissions(session.user.id),
    isBoardMember(session.user.id),
    searchParams,
  ]);

  // Only pages this user can open; the frames run with their own session.
  const quickLinks = NAV_GROUPS.flatMap((g) => g.items)
    .filter((item) => item.href !== "/simulator" && canSeeNavItem(item, grants, board))
    .map((item) => ({ label: item.label, href: item.href }));
  const initialPath = typeof params.path === "string" ? params.path : "/";

  // Every page this user can reach, plus the forms inside the Boardroom and
  // Meetings, so a full test run covers them too.
  const areas = NAV_GROUPS.flatMap((g) =>
    g.items
      .filter((item) => item.href !== "/simulator" && canSeeNavItem(item, grants, board))
      .map((item) => ({ group: g.label, label: item.label, href: item.href, planned: Boolean(item.planned) })),
  );
  if (board) areas.push({ group: "Boardroom", label: "Table a decision", href: "/boardroom/decisions/new", planned: false });
  areas.push({ group: "Collaborate", label: "Schedule a meeting", href: "/meetings/new", planned: false });

  return (
    <div className="space-y-4">
      <div>
        <h1 className="text-2xl font-heading font-bold">Web and phone preview</h1>
        <p className="text-sm text-muted-foreground text-justify max-w-3xl">
          The live KASI app on this deployment, shown at desktop size and at phone size side by side.
          Every update pushed to the main branch appears here after it deploys. Click inside either
          device to use it; with Linked on, the other device follows.
        </p>
      </div>
      <DeviceSimulator quickLinks={quickLinks} areas={areas} initialPath={initialPath} />
    </div>
  );
}
