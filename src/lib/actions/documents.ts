"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import {
  createDocument,
  moduleForEntity,
  type DocumentEntityType,
} from "@/lib/documents";
import { userHasPermission } from "@/lib/permissions";

export async function uploadDocumentAction(
  entityType: DocumentEntityType,
  entityId: string,
  revalidate: string,
  formData: FormData,
) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const entityModule = moduleForEntity(entityType);
  let allowed = await userHasPermission(session.user.id, entityModule, "upload");

  // Self-scoping fallback, mirroring the download route: an employee
  // uploading to their own record only needs the generic documents:upload
  // grant, not the (more sensitive) hr:upload grant.
  if (!allowed && entityType === "employee") {
    const employee = await prisma.employee.findUnique({
      where: { id: entityId },
      select: { userId: true },
    });
    if (employee?.userId === session.user.id) {
      allowed = await userHasPermission(session.user.id, "documents", "upload");
    }
  }

  if (!allowed) throw new Error("Forbidden");

  const file = formData.get("file");
  const category = String(formData.get("category") ?? "general");
  if (!(file instanceof File) || file.size === 0) {
    throw new Error("No file selected");
  }

  await createDocument({
    entityType,
    entityId,
    category,
    file,
    uploadedById: session.user.id,
  });

  revalidatePath(revalidate);
}
