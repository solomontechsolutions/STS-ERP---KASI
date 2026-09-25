"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { notifyUsers } from "@/lib/notifications";

async function requireUserId() {
  const session = await auth();
  if (!session?.user) throw new Error("Unauthorized");
  return session.user.id;
}

const subscriptionSchema = z.object({
  endpoint: z.url(),
  keys: z.object({ p256dh: z.string().min(1), auth: z.string().min(1) }),
});

export async function savePushSubscriptionAction(input: unknown, userAgent?: string) {
  const userId = await requireUserId();
  const sub = subscriptionSchema.parse(input);
  // An endpoint identifies one browser install. If another account signed in
  // on this device earlier, the device now belongs to the current user.
  await prisma.pushSubscription.upsert({
    where: { endpoint: sub.endpoint },
    update: { userId, p256dh: sub.keys.p256dh, auth: sub.keys.auth, userAgent },
    create: {
      userId,
      endpoint: sub.endpoint,
      p256dh: sub.keys.p256dh,
      auth: sub.keys.auth,
      userAgent,
    },
  });
  return { ok: true };
}

export async function removePushSubscriptionAction(endpoint: string) {
  const userId = await requireUserId();
  await prisma.pushSubscription.deleteMany({ where: { endpoint, userId } });
  return { ok: true };
}

export async function sendTestPushAction() {
  const userId = await requireUserId();
  await notifyUsers([userId], {
    category: "system",
    title: "KASI notifications are on",
    body: "This device will now receive alerts for decisions, meetings and agreements.",
    url: "/notifications",
  });
  revalidatePath("/notifications");
  return { ok: true };
}

export async function markNotificationReadAction(id: string) {
  const userId = await requireUserId();
  await prisma.notification.updateMany({
    where: { id, userId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/notifications");
}

export async function markAllNotificationsReadAction() {
  const userId = await requireUserId();
  await prisma.notification.updateMany({
    where: { userId, readAt: null },
    data: { readAt: new Date() },
  });
  revalidatePath("/", "layout");
}
