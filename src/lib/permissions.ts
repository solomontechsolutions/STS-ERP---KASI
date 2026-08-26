import { prisma } from "@/lib/prisma";
import type { Module, Verb } from "@/lib/rbac";

/**
 * Coarse (module, verb) authorization check, enforced server-side.
 * Row-level scoping (e.g. an Employee only ever seeing their own HR record)
 * is layered on top of this at the query layer in each module's data
 * access functions — this only answers "does this user's role bundle grant
 * this verb on this module at all".
 */
export async function userHasPermission(
  userId: string,
  module: Module,
  verb: Verb,
): Promise<boolean> {
  const count = await prisma.userRole.count({
    where: {
      userId,
      role: {
        permissions: {
          some: { module, verb },
        },
      },
    },
  });
  return count > 0;
}

export async function getUserPermissions(userId: string) {
  const userRoles = await prisma.userRole.findMany({
    where: { userId },
    include: { role: { include: { permissions: true } } },
  });

  const grants = new Set<string>();
  for (const ur of userRoles) {
    for (const p of ur.role.permissions) {
      grants.add(`${p.module}:${p.verb}`);
    }
  }
  return grants;
}
