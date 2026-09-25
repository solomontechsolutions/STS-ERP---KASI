"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";
import { notifyUsers } from "@/lib/notifications";
import { hashAgreementBody } from "@/lib/boardroom/agreements";
import {
  canAdministerBoardroom,
  getBoardMember,
  listBoardMembers,
} from "@/lib/boardroom/members";

export type FormState = { error?: string; ok?: boolean };

function normalizeName(name: string) {
  return name.trim().replace(/\s+/g, " ").toLowerCase();
}

const signSchema = z.object({
  templateId: z.string().min(1),
  signedName: z.string().trim().min(3, "Type your full name."),
  password: z.string().min(1, "Enter your KASI password to confirm."),
  signatureImage: z
    .string()
    .startsWith("data:image/png;base64,", "Draw your signature in the box.")
    .max(400_000, "Signature image is too large. Clear it and sign again."),
  consent: z.literal("on", { error: "Tick the box to confirm you have read and agree." }),
});

/**
 * Signing needs three things, each recorded as evidence: the typed full name
 * (must match the account name), a drawn signature, and the account password
 * re-entered, so a signature cannot be given from an unlocked device left
 * unattended. The SHA-256 of the exact text signed is stored with it.
 */
export async function signAgreementAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "Your session has expired. Sign in again." };

  const parsed = signSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const input = parsed.data;

  const member = await getBoardMember(session.user.id);
  if (!member) return { error: "Only directors and shareholders sign founder agreements." };

  const [user, template] = await Promise.all([
    prisma.user.findUnique({ where: { id: session.user.id } }),
    prisma.agreementTemplate.findUnique({ where: { id: input.templateId } }),
  ]);
  if (!user || !template) return { error: "Agreement not found." };
  if (!template.isCurrent) {
    return { error: "A newer version of this agreement has been published. Reload and sign that one." };
  }
  if (normalizeName(input.signedName) !== normalizeName(user.name)) {
    return { error: `Type your full name exactly as registered: ${user.name}.` };
  }
  if (!(await bcrypt.compare(input.password, user.passwordHash))) {
    return { error: "Password is incorrect." };
  }
  if (hashAgreementBody(template.body) !== template.contentHash) {
    return { error: "This agreement's text failed its integrity check. Contact the Company Secretary." };
  }

  const meta = await getRequestMeta();
  try {
    const signature = await prisma.agreementSignature.create({
      data: {
        templateId: template.id,
        userId: user.id,
        signedName: input.signedName.trim(),
        signatureImage: input.signatureImage,
        contentHash: template.contentHash,
        ipAddress: meta.ipAddress,
        userAgent: meta.userAgent,
      },
    });
    await recordAudit({
      entityType: "agreement_signature",
      entityId: signature.id,
      action: "sign",
      actorId: user.id,
      afterData: {
        agreement: template.code,
        version: template.version,
        contentHash: template.contentHash,
      },
      ...meta,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return { error: "You have already signed this version." };
    }
    throw error;
  }

  revalidatePath("/boardroom", "layout");
  redirect(`/boardroom/agreements/${template.id}?signed=1`);
}

const publishSchema = z.object({
  code: z.string().min(1),
  title: z.string().trim().min(3),
  summary: z.string().trim().min(10),
  body: z.string().trim().min(50, "The agreement text is too short."),
});

/**
 * Publishes new wording as the next version. Old versions and their
 * signatures stay intact as history; everyone is asked to sign the new one.
 */
export async function publishAgreementVersionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "Your session has expired. Sign in again." };
  const member = await getBoardMember(session.user.id);
  if (!canAdministerBoardroom(member)) {
    return { error: "Only directors or the Company Secretary can publish agreement wording." };
  }

  const parsed = publishSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const input = parsed.data;
  const body = input.body.replace(/\r\n/g, "\n");

  const current = await prisma.agreementTemplate.findFirst({
    where: { code: input.code, isCurrent: true },
    orderBy: { version: "desc" },
  });
  if (!current) return { error: "Agreement not found." };
  if (hashAgreementBody(body) === current.contentHash && input.title === current.title) {
    return { error: "Nothing changed: the wording is identical to the current version." };
  }

  const created = await prisma.$transaction(async (tx) => {
    await tx.agreementTemplate.updateMany({
      where: { code: input.code, isCurrent: true },
      data: { isCurrent: false },
    });
    return tx.agreementTemplate.create({
      data: {
        code: input.code,
        version: current.version + 1,
        title: input.title,
        summary: input.summary,
        body,
        contentHash: hashAgreementBody(body),
        isCurrent: true,
        publishedById: session.user.id,
      },
    });
  });

  await recordAudit({
    entityType: "agreement_template",
    entityId: created.id,
    action: "publish",
    actorId: session.user.id,
    beforeData: { version: current.version, contentHash: current.contentHash },
    afterData: { version: created.version, contentHash: created.contentHash },
  });

  const members = await listBoardMembers();
  await notifyUsers(
    members.map((m) => m.userId),
    {
      category: "agreement",
      title: `New version to sign: ${created.title}`,
      body: `Version ${created.version} has been published by ${session.user.name ?? "the board"}. Please read and sign it.`,
      url: `/boardroom/agreements/${created.id}`,
    },
  );

  revalidatePath("/boardroom", "layout");
  redirect(`/boardroom/agreements/${created.id}`);
}

/** Reminds everyone who has not yet signed the current versions. */
export async function remindUnsignedAction() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const member = await getBoardMember(session.user.id);
  if (!canAdministerBoardroom(member)) throw new Error("Forbidden");

  const [members, templates] = await Promise.all([
    listBoardMembers(),
    prisma.agreementTemplate.findMany({
      where: { isCurrent: true },
      include: { signatures: { select: { userId: true } } },
    }),
  ]);
  for (const m of members) {
    const pending = templates.filter((t) => !t.signatures.some((s) => s.userId === m.userId));
    if (pending.length === 0) continue;
    await notifyUsers([m.userId], {
      category: "agreement",
      title: `${pending.length} founder agreement${pending.length === 1 ? "" : "s"} awaiting your signature`,
      body: pending.map((t) => t.title).join(", "),
      url: "/boardroom/agreements",
    });
  }
  revalidatePath("/boardroom/agreements");
}
