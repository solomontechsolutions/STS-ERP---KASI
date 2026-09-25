"use server";

import { revalidatePath } from "next/cache";
import { redirect } from "next/navigation";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notifications";
import { getBoardMember, listBoardMembers } from "@/lib/boardroom/members";
import { isBoardMeetingKind, newRoomName } from "@/lib/meetings";

export type FormState = { error?: string; ok?: boolean };

const EAT = { timeZone: "Africa/Dar_es_Salaam", dateStyle: "medium", timeStyle: "short" } as const;

const createSchema = z.object({
  title: z.string().trim().min(3, "Give the meeting a title."),
  agenda: z.string().trim().min(3, "Add an agenda."),
  kind: z.enum(["board", "shareholders", "management", "general"]),
  scheduledAt: z.string().min(1, "Choose a date and time."),
  durationMinutes: z.coerce.number().int().min(15).max(480),
});

export async function createMeetingAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const session = await auth();
  if (!session?.user) return { error: "Your session has expired. Sign in again." };

  const parsed = createSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };
  const input = parsed.data;

  const boardMeeting = isBoardMeetingKind(input.kind);
  if (boardMeeting && !(await getBoardMember(session.user.id))) {
    return { error: "Only directors and shareholders can call a board or shareholders' meeting." };
  }

  const offset = Number(formData.get("tzOffset") ?? 0);
  const scheduledAt = new Date(`${input.scheduledAt}:00Z`);
  scheduledAt.setUTCMinutes(scheduledAt.getUTCMinutes() + (Number.isFinite(offset) ? offset : 0));
  if (Number.isNaN(scheduledAt.getTime())) return { error: "Invalid date." };

  // Board meetings invite every founder automatically; other meetings invite
  // whoever was ticked. The organiser is always invited.
  let inviteeIds: string[];
  if (boardMeeting) {
    inviteeIds = (await listBoardMembers()).map((m) => m.userId);
  } else {
    const picked = formData.getAll("invitees").map(String);
    const valid = await prisma.user.findMany({
      where: { id: { in: picked }, isActive: true },
      select: { id: true },
    });
    inviteeIds = valid.map((u) => u.id);
  }
  inviteeIds = [...new Set([...inviteeIds, session.user.id])];

  const meeting = await prisma.meeting.create({
    data: {
      title: input.title,
      agenda: input.agenda,
      kind: input.kind,
      scheduledAt,
      durationMinutes: input.durationMinutes,
      roomName: newRoomName(),
      createdById: session.user.id,
      invitees: { create: inviteeIds.map((userId) => ({ userId })) },
    },
  });

  await recordAudit({
    entityType: "meeting",
    entityId: meeting.id,
    action: "create",
    actorId: session.user.id,
    afterData: { title: meeting.title, kind: meeting.kind, scheduledAt, invitees: inviteeIds },
  });

  await notifyUsers(
    inviteeIds.filter((id) => id !== session.user.id),
    {
      category: "meeting",
      title: `Meeting invite: ${meeting.title}`,
      body: `${session.user.name ?? "A colleague"} invited you for ${scheduledAt.toLocaleString("en-GB", EAT)} EAT.`,
      url: `/meetings/${meeting.id}`,
    },
  );

  revalidatePath("/meetings");
  redirect(`/meetings/${meeting.id}`);
}

async function requireOrganiser(meetingId: string) {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    include: { invitees: { select: { userId: true } } },
  });
  if (!meeting) throw new Error("Not found");
  const member = await getBoardMember(session.user.id);
  const isOrganiser =
    meeting.createdById === session.user.id ||
    (isBoardMeetingKind(meeting.kind) && Boolean(member?.isCompanySecretary));
  if (!isOrganiser) throw new Error("Only the organiser can do this.");
  return { userId: session.user.id, userName: session.user.name, meeting };
}

export async function cancelMeetingAction(meetingId: string) {
  const { userId, meeting } = await requireOrganiser(meetingId);
  if (meeting.status !== "scheduled") return;
  await prisma.meeting.update({ where: { id: meetingId }, data: { status: "cancelled" } });
  await recordAudit({ entityType: "meeting", entityId: meetingId, action: "cancel", actorId: userId });
  await notifyUsers(
    meeting.invitees.map((i) => i.userId).filter((id) => id !== userId),
    {
      category: "meeting",
      title: `Cancelled: ${meeting.title}`,
      body: `The meeting set for ${meeting.scheduledAt.toLocaleString("en-GB", EAT)} EAT has been cancelled.`,
      url: `/meetings/${meetingId}`,
    },
  );
  revalidatePath("/meetings", "layout");
}

export async function endMeetingAction(meetingId: string) {
  const { userId } = await requireOrganiser(meetingId);
  await prisma.meeting.updateMany({
    where: { id: meetingId, status: "scheduled" },
    data: { status: "ended" },
  });
  await recordAudit({ entityType: "meeting", entityId: meetingId, action: "end", actorId: userId });
  revalidatePath("/meetings", "layout");
}

const minutesSchema = z.object({
  meetingId: z.string().min(1),
  minutes: z.string().trim().min(10, "Minutes are too short."),
});

export async function saveMinutesAction(
  _prev: FormState,
  formData: FormData,
): Promise<FormState> {
  const parsed = minutesSchema.safeParse(Object.fromEntries(formData));
  if (!parsed.success) return { error: parsed.error.issues[0]?.message ?? "Invalid input." };

  let ctx;
  try {
    ctx = await requireOrganiser(parsed.data.meetingId);
  } catch (error) {
    return { error: error instanceof Error ? error.message : "Not allowed." };
  }
  const { meeting, userId } = ctx;

  await prisma.meeting.update({
    where: { id: meeting.id },
    data: { minutes: parsed.data.minutes, minutesAt: new Date(), status: meeting.status === "cancelled" ? "cancelled" : "ended" },
  });
  await recordAudit({
    entityType: "meeting",
    entityId: meeting.id,
    action: "minutes",
    actorId: userId,
    beforeData: { minutes: meeting.minutes },
    afterData: { minutes: parsed.data.minutes },
  });
  await notifyUsers(
    meeting.invitees.map((i) => i.userId).filter((id) => id !== userId),
    {
      category: "meeting",
      title: `Minutes recorded: ${meeting.title}`,
      body: "The minutes of the meeting are now available in KASI.",
      url: `/meetings/${meeting.id}`,
    },
  );
  revalidatePath(`/meetings/${meeting.id}`);
  return { ok: true };
}

/** Attendance register: first join time per invitee. */
export async function recordJoinAction(meetingId: string) {
  const session = await auth();
  if (!session?.user) return;
  await prisma.meetingInvitee.updateMany({
    where: { meetingId, userId: session.user.id, joinedAt: null },
    data: { joinedAt: new Date() },
  });
}
