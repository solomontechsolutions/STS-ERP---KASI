import { auth } from "@/auth";
import { getUserPermissions } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/empty-state";
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

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold mb-1">
        Welcome back, {firstName}
      </h1>
      <p className="text-sm text-muted-foreground mb-6">
        This is KASI&apos;s foundation build — architecture, auth and access
        control are live; business modules land in later phases.
      </p>

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
