import { redirect } from "next/navigation";
import { ShieldAlert } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { userHasPermission } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/empty-state";
import { AccessTable } from "@/components/settings/AccessTable";

export default async function AccessSettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [canView, canEdit] = await Promise.all([
    userHasPermission(session.user.id, "settings", "view"),
    userHasPermission(session.user.id, "settings", "edit"),
  ]);

  if (!canView) {
    return (
      <EmptyState
        icon={ShieldAlert}
        title="No access"
        description="Your account doesn't hold a role with Settings visibility."
      />
    );
  }

  const [users, roles] = await Promise.all([
    prisma.user.findMany({
      orderBy: { name: "asc" },
      include: { roles: { select: { roleId: true } } },
    }),
    prisma.role.findMany({ orderBy: { label: "asc" } }),
  ]);

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold mb-1">Users & Access</h1>
      <p className="text-sm text-muted-foreground mb-6">
        Roles are composable — a user can hold more than one bundle at once.
        {!canEdit && " You have view-only access to this page."}
      </p>

      <AccessTable
        canEdit={canEdit}
        roles={roles.map((r) => ({ id: r.id, label: r.label }))}
        users={users.map((u) => ({
          id: u.id,
          name: u.name,
          email: u.email,
          isActive: u.isActive,
          mustResetPassword: u.mustResetPassword,
          roleIds: u.roles.map((r) => r.roleId),
        }))}
      />
    </div>
  );
}
