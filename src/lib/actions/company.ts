"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { userHasPermission } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";

const schema = z.object({
  legalName: z.string().min(1, "Required"),
  tradingName: z.string().optional(),
  registeredOfficeAddress: z.string().min(1, "Required"),
  poBox: z.string().optional(),
  taxOffice: z.string().optional(),
  accountingReferenceDate: z.string().optional(),
});

export async function updateCompanyAction(formData: FormData) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");

  const allowed = await userHasPermission(session.user.id, "settings", "edit");
  if (!allowed) throw new Error("Forbidden");

  const parsed = schema.parse({
    legalName: formData.get("legalName"),
    tradingName: formData.get("tradingName") || undefined,
    registeredOfficeAddress: formData.get("registeredOfficeAddress"),
    poBox: formData.get("poBox") || undefined,
    taxOffice: formData.get("taxOffice") || undefined,
    accountingReferenceDate: formData.get("accountingReferenceDate") || undefined,
  });

  const existing = await prisma.company.findFirst();
  if (!existing) throw new Error("No company record exists to update");

  const updated = await prisma.company.update({
    where: { id: existing.id },
    data: parsed,
  });

  await recordAudit({
    entityType: "company",
    entityId: updated.id,
    action: "update",
    actorId: session.user.id,
    beforeData: existing,
    afterData: updated,
  });

  revalidatePath("/settings/company");
}
