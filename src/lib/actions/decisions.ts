"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { Prisma } from "@prisma/client";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";
import { notifyUsers } from "@/lib/notifications";
import {
  canAdministerBoardroom,
  getBoardMember,
  listBoardMembers,
} from "@/lib/boardroom/members";
import {
  buildElectorate,
  nextDecisionReference,
  parseElectorate,
  settleDecision,
  type VotingBasis,
} from "@/lib/boardroom/decisions";

export type FormState = { error?: string; ok?: boolean };

const createSchema = z.object({
  title: z.string().trim().min(5, "Give the decision a clear title."),
  background: z.string().trim().min(10, "Explain the background."),
  proposedAction: z.string().trim().min(5, "State what the company will do if this passes."),
  category: z.enum(["board_resolution", "shareholder_resolution"]),
  threshold: z.enum(["simple_majority", "special_75", "unanimous"]),
  closesAt: z.string().min(1, "Set a voting deadline."),
  meetingId: z.string().optional(),
});

export async function createDecisionAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "Your session has expired. Sign in again." };
  const member = await getBoardMember(session.user.id);
  if (!canAdministerBoardroom(member)) {
    return { error: "Only directors or the Company Secretary can table a decision." };
  }

  const parsed = createSchema.safeParse({
    ...Object.fromEntries(formData),
    meetingId: formData.get("meetingId") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const input = parsed.data;

  // datetime-local has no zone; the form sends the browser's UTC offset.
  const offset = Number(formData.get("tzOffset") ?? 0);
  const closesAt = new Date(`${input.closesAt}:00Z`);
  closesAt.setUTCMinutes(closesAt.getUTCMinutes() + (Number.isFinite(offset) ? offset : 0));
  if (Number.isNaN(closesAt.getTime()) || closesAt.getTime() < Date.now() + 10 * 60 * 1000) {
    return { error: "The deadline must be at least 10 minutes from now." };
  }

  const basis: VotingBasis =
    input.category === "shareholder_resolution" ? "shareholding" : "per_director";
  const members = await listBoardMembers();
  const electorate = buildElectorate(members, basis);
  if (electorate.length === 0) return { error: "No eligible voters were found." };

  // Retry on the rare reference collision from two tablings at once.
  let decisionId = "";
  for (let attempt = 0; attempt < 3 && !decisionId; attempt++) {
    try {
      const decision = await prisma.decision.create({
        data: {
          reference: await nextDecisionReference(),
          title: input.title,
          background: input.background,
          proposedAction: input.proposedAction,
          category: input.category,
          votingBasis: basis,
          threshold: input.threshold,
          electorate: electorate as unknown as Prisma.InputJsonValue,
          closesAt,
          proposedById: session.user.id,
          meetingId: input.meetingId,
        },
      });
      decisionId = decision.id;
      await recordAudit({
        entityType: "decision",
        entityId: decision.id,
        action: "create",
        actorId: session.user.id,
        afterData: decision,
      });
      // Every founder sees every decision, voter or not (transparency).
      await notifyUsers(
        members.map((m) => m.userId),
        {
          category: "decision",
          title: `${decision.reference}: vote needed`,
          body: `${decision.title}. Voting closes ${closesAt.toLocaleString("en-GB", { timeZone: "Africa/Dar_es_Salaam", dateStyle: "medium", timeStyle: "short" })} EAT.`,
          url: `/boardroom/decisions/${decision.id}`,
        },
      );
    } catch (error) {
      if ((error as { code?: string }).code !== "P2002" || attempt === 2) throw error;
    }
  }

  revalidatePath("/boardroom", "layout");
  redirect(`/boardroom/decisions/${decisionId}`);
}

const voteSchema = z.object({
  decisionId: z.string().min(1),
  choice: z.enum(["for", "against", "abstain"], { error: "Choose For, Against or Abstain." }),
  comment: z.string().trim().max(2000).optional(),
});

export async function castVoteAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "Your session has expired. Sign in again." };

  const parsed = voteSchema.safeParse({
    decisionId: formData.get("decisionId"),
    choice: formData.get("choice"),
    comment: formData.get("comment") || undefined,
  });
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const input = parsed.data;

  const decision = await prisma.decision.findUnique({ where: { id: input.decisionId } });
  if (!decision) return { error: "Decision not found." };
  if (decision.status !== "open" || decision.closesAt.getTime() <= Date.now()) {
    await settleDecision(decision.id);
    revalidatePath(`/boardroom/decisions/${decision.id}`);
    return { error: "Voting on this decision has closed." };
  }

  const voter = parseElectorate(decision.electorate).find((e) => e.userId === session.user.id);
  if (!voter) return { error: "You are not eligible to vote on this decision." };

  const meta = await getRequestMeta();
  try {
    const vote = await prisma.decisionVote.create({
      data: {
        decisionId: decision.id,
        userId: session.user.id,
        choice: input.choice,
        weight: voter.weight,
        comment: input.comment,
      },
    });
    await recordAudit({
      entityType: "decision_vote",
      entityId: vote.id,
      action: "vote",
      actorId: session.user.id,
      afterData: { decision: decision.reference, choice: vote.choice, weight: voter.weight },
      ...meta,
    });
  } catch (error) {
    if ((error as { code?: string }).code === "P2002") {
      return { error: "You have already voted on this decision. Votes are final." };
    }
    throw error;
  }

  if (input.comment) {
    await prisma.decisionComment.create({
      data: { decisionId: decision.id, userId: session.user.id, body: `Vote note: ${input.comment}` },
    });
  }

  await settleDecision(decision.id, session.user.id);
  revalidatePath("/boardroom", "layout");
  return { ok: true };
}

const commentSchema = z.object({
  decisionId: z.string().min(1),
  body: z.string().trim().min(1, "Write a comment first.").max(4000),
});

export async function addDecisionCommentAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "Your session has expired. Sign in again." };
  if (!(await getBoardMember(session.user.id))) return { error: "Only founders can comment." };

  const parsed = commentSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  const decision = await prisma.decision.findUnique({ where: { id: parsed.data.decisionId } });
  if (!decision) return { error: "Decision not found." };

  await prisma.decisionComment.create({
    data: { decisionId: decision.id, userId: session.user.id, body: parsed.data.body },
  });

  const members = await listBoardMembers();
  await notifyUsers(
    members.map((m) => m.userId).filter((id) => id !== session.user.id),
    {
      category: "decision",
      title: `${decision.reference}: new comment`,
      body: `${session.user.name ?? "A founder"}: ${parsed.data.body.slice(0, 140)}`,
      url: `/boardroom/decisions/${decision.id}`,
    },
  );

  revalidatePath(`/boardroom/decisions/${decision.id}`);
  return { ok: true };
}

export async function withdrawDecisionAction(decisionId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const decision = await prisma.decision.findUnique({
    where: { id: decisionId },
    include: { _count: { select: { votes: true } } },
  });
  if (!decision) throw new Error("Not found");
  if (decision.proposedById !== session.user.id) {
    throw new Error("Only the proposer can withdraw a decision.");
  }
  if (decision.status !== "open" || decision._count.votes > 0) {
    throw new Error("A decision can only be withdrawn before anyone has voted.");
  }

  await prisma.decision.update({
    where: { id: decisionId },
    data: { status: "withdrawn", closedAt: new Date(), outcomeNote: "Withdrawn by the proposer before any vote." },
  });
  await recordAudit({
    entityType: "decision",
    entityId: decisionId,
    action: "withdraw",
    actorId: session.user.id,
  });
  revalidatePath("/boardroom", "layout");
}
