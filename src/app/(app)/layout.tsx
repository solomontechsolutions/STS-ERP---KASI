import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserPermissions } from "@/lib/permissions";
import { NAV_GROUPS, canSeeNavItem, type SerializableNavGroup } from "@/lib/nav";
import { isBoardMember } from "@/lib/boardroom/members";
import { unreadNotificationCount } from "@/lib/notifications";
import { ServiceWorkerRegistrar } from "@/components/pwa/ServiceWorkerRegistrar";
import { Sidebar } from "@/components/layout/Sidebar";
import { Topbar } from "@/components/layout/Topbar";

export default async function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (session.user.mustResetPassword) redirect("/reset-password");

  const [userRoles, grants, boardMember, unreadCount] = await Promise.all([
    prisma.userRole.findMany({
      where: { userId: session.user.id },
      include: { role: true },
    }),
    getUserPermissions(session.user.id),
    isBoardMember(session.user.id),
    unreadNotificationCount(session.user.id),
  ]);

  // Project rather than spread: `group.icon` is a React component and cannot
  // be serialized into the client <Sidebar /> props.
  const visibleGroups: SerializableNavGroup[] = NAV_GROUPS.map((group) => ({
    label: group.label,
    items: group.items.filter((item) => canSeeNavItem(item, grants, boardMember)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background print:block print:h-auto print:w-auto print:overflow-visible">
      <ServiceWorkerRegistrar />
      <Sidebar groups={visibleGroups} />
      <div className="flex flex-1 flex-col overflow-hidden min-w-0 print:block print:overflow-visible">
        <Topbar
          userName={session.user.name ?? session.user.email ?? ""}
          roleLabels={userRoles.map((ur) => ur.role.label)}
          navGroups={visibleGroups}
          unreadCount={unreadCount}
        />
        <main className="flex-1 overflow-y-auto p-4 md:p-6 print:overflow-visible print:p-0">{children}</main>
      </div>
    </div>
  );
}
