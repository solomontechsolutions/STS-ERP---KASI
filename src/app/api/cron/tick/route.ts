import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { getSelcomConfig, syncSelcomOrders } from "@/lib/integrations/selcom";
import { settleExpiredDecisions } from "@/lib/boardroom/decisions";
import { notifyUsers } from "@/lib/notifications";

/**
 * Background housekeeping, meant to be called every 5 to 15 minutes by a
 * scheduler with `Authorization: Bearer <CRON_SECRET>`:
 *
 * - reads the last day of Selcom orders into the revenue report,
 * - closes decisions whose voting deadline has passed and announces results,
 * - sends a reminder push 15 minutes before each meeting.
 *
 * Every step runs independently so one failing does not block the others.
 * See README "Scheduled jobs" for scheduler options.
 */
export const dynamic = "force-dynamic";
export const maxDuration = 60;

function authorized(request: Request) {
  const secret = process.env.CRON_SECRET;
  if (!secret || secret.length < 16) return false;
  const provided = request.headers.get("authorization")?.replace(/^Bearer\s+/i, "") ?? "";
  const a = Buffer.from(provided);
  const b = Buffer.from(secret);
  return a.length === b.length && timingSafeEqual(a, b);
}

async function remindUpcomingMeetings() {
  const now = new Date();
  const soon = new Date(now.getTime() + 15 * 60 * 1000);
  const meetings = await prisma.meeting.findMany({
    where: { status: "scheduled", reminderSentAt: null, scheduledAt: { gte: now, lte: soon } },
    include: { invitees: { select: { userId: true } } },
  });
  for (const m of meetings) {
    const claimed = await prisma.meeting.updateMany({
      where: { id: m.id, reminderSentAt: null },
      data: { reminderSentAt: now },
    });
    if (claimed.count === 0) continue;
    const minutes = Math.max(1, Math.round((m.scheduledAt.getTime() - now.getTime()) / 60000));
    await notifyUsers(
      m.invitees.map((i) => i.userId),
      {
        category: "meeting",
        title: `Starting in ${minutes} min: ${m.title}`,
        body: "Tap to join the meeting in KASI.",
        url: `/meetings/${m.id}`,
      },
    );
  }
  return meetings.length;
}

async function step<T>(fn: () => Promise<T>) {
  try {
    return { ok: true, result: await fn() };
  } catch (error) {
    return { ok: false, error: error instanceof Error ? error.message : String(error) };
  }
}

async function handle(request: Request) {
  if (!authorized(request)) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const [selcom, decisions, reminders] = await Promise.all([
    getSelcomConfig()
      ? step(async () => {
          const run = await syncSelcomOrders({
            from: new Date(now.getTime() - 24 * 60 * 60 * 1000),
            to: now,
            trigger: "cron",
          });
          return { upserted: run.upserted };
        })
      : Promise.resolve({ ok: true, result: "skipped: Selcom not configured" }),
    step(settleExpiredDecisions),
    step(remindUpcomingMeetings),
  ]);

  return NextResponse.json({ ranAt: now.toISOString(), selcom, decisions, reminders });
}

// Vercel Cron issues GET; other schedulers can use either.
export const GET = handle;
export const POST = handle;
