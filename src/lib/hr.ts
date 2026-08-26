import { prisma } from "@/lib/prisma";
import { userHasPermission } from "@/lib/permissions";

// Row-level scoping for HR data (Section 6.3): the coarse "employee" role
// only ever grants hr:view, never anything past it, so "holds a verb beyond
// view" is a reliable proxy for "holds broad HR visibility" without having
// to special-case role names here.
const BROAD_ACCESS_VERBS = ["create", "edit", "approve", "export", "delete"] as const;

async function hasBroadHrAccess(userId: string) {
  for (const verb of BROAD_ACCESS_VERBS) {
    if (await userHasPermission(userId, "hr", verb)) return true;
  }
  return false;
}

export async function getVisibleEmployees(userId: string) {
  if (await hasBroadHrAccess(userId)) {
    return prisma.employee.findMany({ orderBy: { fullName: "asc" } });
  }
  return prisma.employee.findMany({
    where: { userId },
    orderBy: { fullName: "asc" },
  });
}

export async function getVisibleEmployee(userId: string, employeeId: string) {
  const employee = await prisma.employee.findUnique({
    where: { id: employeeId },
  });
  if (!employee) return null;
  if (employee.userId === userId) return employee;
  if (await hasBroadHrAccess(userId)) return employee;
  return null;
}

export async function canViewCompensation(
  userId: string,
  employee: { userId: string | null },
) {
  if (employee.userId === userId) return true;
  return userHasPermission(userId, "hr_compensation", "view");
}
