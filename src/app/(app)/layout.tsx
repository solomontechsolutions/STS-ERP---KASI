import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { getUserPermissions } from "@/lib/permissions";
import { NAV_GROUPS } from "@/lib/nav";
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

  const [userRoles, grants] = await Promise.all([
    prisma.userRole.findMany({
      where: { userId: session.user.id },
      include: { role: true },
    }),
    getUserPermissions(session.user.id),
  ]);

  const visibleGroups = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => grants.has(`${item.module}:view`)),
  })).filter((group) => group.items.length > 0);

  return (
    <div className="flex h-screen w-screen overflow-hidden bg-background">
      <Sidebar groups={visibleGroups} />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Topbar
          userName={session.user.name ?? session.user.email ?? ""}
          roleLabels={userRoles.map((ur) => ur.role.label)}
        />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
