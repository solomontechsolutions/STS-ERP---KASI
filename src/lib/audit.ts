import { prisma } from "@/lib/prisma";

type AuditEntry = {
  entityType: string;
  entityId: string;
  action: string;
  actorId?: string | null;
  beforeData?: unknown;
  afterData?: unknown;
  ipAddress?: string | null;
  userAgent?: string | null;
};

/**
 * The only sanctioned write path to AuditLog. Every module should call this
 * from its server-side mutation functions rather than writing audit rows
 * itself. Entries are append-only — nothing in the application ever updates
 * or deletes a row here (Section 18 of the build brief).
 */
// Prisma's Json columns need plain JSON-serializable values. Round-tripping
// through JSON.stringify/parse lets callers pass Prisma model objects
// (Decimal, Date, etc.) straight through — both implement toJSON().
function toJson(value: unknown) {
  if (value === undefined) return undefined;
  return JSON.parse(JSON.stringify(value));
}

export async function recordAudit(entry: AuditEntry) {
  await prisma.auditLog.create({
    data: {
      entityType: entry.entityType,
      entityId: entry.entityId,
      action: entry.action,
      actorId: entry.actorId ?? null,
      beforeData: toJson(entry.beforeData),
      afterData: toJson(entry.afterData),
      ipAddress: entry.ipAddress ?? null,
      userAgent: entry.userAgent ?? null,
    },
  });
}
