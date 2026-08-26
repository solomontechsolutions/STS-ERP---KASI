"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { userHasPermission } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";

async function assertCanManageAccess() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const allowed = await userHasPermission(session.user.id, "settings", "edit");
  if (!allowed) throw new Error("Forbidden");
  return session.user.id;
}

export async function setUserRoleAction(
  targetUserId: string,
  roleId: string,
  grant: boolean,
) {
  const actorId = await assertCanManageAccess();

  if (grant) {
    await prisma.userRole.upsert({
      where: { userId_roleId: { userId: targetUserId, roleId } },
      update: {},
      create: { userId: targetUserId, roleId, grantedById: actorId },
    });
  } else {
    await prisma.userRole.deleteMany({ where: { userId: targetUserId, roleId } });
  }

  await recordAudit({
    entityType: "user_role",
    entityId: targetUserId,
    action: grant ? "role_grant" : "role_revoke",
    actorId,
    afterData: { roleId, grant },
  });

  revalidatePath("/settings/access");
}

export async function setUserActiveAction(targetUserId: string, isActive: boolean) {
  const actorId = await assertCanManageAccess();
  if (targetUserId === actorId && !isActive) {
    throw new Error("You cannot deactivate your own account");
  }

  const updated = await prisma.user.update({
    where: { id: targetUserId },
    data: { isActive },
  });

  await recordAudit({
    entityType: "user",
    entityId: updated.id,
    action: isActive ? "activate" : "deactivate",
    actorId,
  });

  revalidatePath("/settings/access");
}
