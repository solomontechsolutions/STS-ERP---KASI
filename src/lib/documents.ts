import { randomUUID } from "crypto";
import { prisma } from "@/lib/prisma";
import { storage } from "@/lib/storage";
import { recordAudit } from "@/lib/audit";
import type { Module } from "@/lib/rbac";

export type DocumentEntityType =
  | "employee"
  | "company"
  | "director"
  | "shareholder";

// Documents inherit the sensitivity of the record they're attached to
// (Section 11) — this maps an entity type to the module whose permission
// grants govern access to its documents.
const ENTITY_MODULE: Record<DocumentEntityType, Module> = {
  employee: "hr",
  company: "settings",
  director: "governance",
  shareholder: "governance",
};

export function moduleForEntity(entityType: string): Module {
  return (ENTITY_MODULE as Record<string, Module>)[entityType] ?? "documents";
}

export async function createDocument(input: {
  entityType: DocumentEntityType;
  entityId: string;
  category: string;
  file: File;
  description?: string;
  uploadedById: string;
}) {
  const buffer = Buffer.from(await input.file.arrayBuffer());
  const storageKey = `${input.entityType}/${input.entityId}/${randomUUID()}-${input.file.name}`;
  await storage.put(storageKey, buffer);

  const doc = await prisma.document.create({
    data: {
      entityType: input.entityType,
      entityId: input.entityId,
      category: input.category,
      filename: input.file.name,
      storageKey,
      mimeType: input.file.type || "application/octet-stream",
      sizeBytes: buffer.byteLength,
      description: input.description,
      uploadedById: input.uploadedById,
    },
  });

  await recordAudit({
    entityType: "document",
    entityId: doc.id,
    action: "create",
    actorId: input.uploadedById,
    afterData: {
      filename: doc.filename,
      entityType: doc.entityType,
      entityId: doc.entityId,
      category: doc.category,
    },
  });

  return doc;
}

export async function listDocuments(entityType: string, entityId: string) {
  return prisma.document.findMany({
    where: { entityType, entityId },
    orderBy: { createdAt: "desc" },
    include: { uploadedBy: { select: { name: true } } },
  });
}
