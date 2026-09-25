import webpush from "web-push";
import { prisma } from "@/lib/prisma";

export type NotificationCategory =
  | "decision"
  | "meeting"
  | "agreement"
  | "collection"
  | "system";

export type NotificationInput = {
  category: NotificationCategory;
  title: string;
  body: string;
  /** In-app path opened when the notification is tapped, e.g. "/boardroom/decisions/abc". */
  url?: string;
};

/**
 * Web Push is optional: without VAPID keys the in-app inbox still works and
 * push delivery is simply skipped. Keys are generated once with
 * `npx web-push generate-vapid-keys` (see .env.example).
 */
function configurePush(): boolean {
  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY;
  const privateKey = process.env.VAPID_PRIVATE_KEY;
  if (!publicKey || !privateKey) return false;
  webpush.setVapidDetails(
    process.env.VAPID_SUBJECT || "mailto:no-reply@solomontechsolutions.com",
    publicKey,
    privateKey,
  );
  return true;
}

export function isPushConfigured(): boolean {
  return Boolean(
    process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && process.env.VAPID_PRIVATE_KEY,
  );
}

/**
 * Records an inbox notification for each recipient and pushes it to every
 * device they enabled push on. Push failures never fail the caller: the
 * inbox row is the record, the push is a courtesy. Subscriptions the push
 * service reports as gone (404/410) are deleted so they stop costing a
 * request on every send.
 */
export async function notifyUsers(userIds: string[], input: NotificationInput) {
  const recipients = [...new Set(userIds)];
  if (recipients.length === 0) return;

  await prisma.notification.createMany({
    data: recipients.map((userId) => ({
      userId,
      category: input.category,
      title: input.title,
      body: input.body,
      url: input.url,
    })),
  });

  if (!configurePush()) return;

  const subscriptions = await prisma.pushSubscription.findMany({
    where: { userId: { in: recipients } },
  });
  const payload = JSON.stringify({
    title: input.title,
    body: input.body,
    url: input.url ?? "/notifications",
    tag: input.category,
  });

  await Promise.all(
    subscriptions.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: { p256dh: sub.p256dh, auth: sub.auth } },
          payload,
          { TTL: 60 * 60 * 24 },
        );
        await prisma.pushSubscription.update({
          where: { id: sub.id },
          data: { lastUsedAt: new Date() },
        });
      } catch (error) {
        const status = (error as { statusCode?: number }).statusCode;
        if (status === 404 || status === 410) {
          await prisma.pushSubscription.deleteMany({ where: { id: sub.id } });
        } else {
          console.error("Web Push delivery failed", status, error);
        }
      }
    }),
  );
}

export async function unreadNotificationCount(userId: string) {
  return prisma.notification.count({ where: { userId, readAt: null } });
}
