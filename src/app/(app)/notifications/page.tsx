import Link from "next/link";
import { redirect } from "next/navigation";
import { Bell } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { fmtDateTime } from "@/lib/format";
import { EmptyState } from "@/components/ui/empty-state";
import { PushSettings } from "@/components/pwa/PushSettings";
import {
  markAllNotificationsReadAction,
  markNotificationReadAction,
} from "@/lib/actions/notifications";
import { cn } from "@/lib/cn";

export default async function NotificationsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const notifications = await prisma.notification.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "desc" },
    take: 100,
  });
  const unread = notifications.filter((n) => !n.readAt).length;

  return (
    <div className="max-w-3xl space-y-6">
      <h1 className="text-2xl font-heading font-bold">Notifications</h1>

      <PushSettings vapidPublicKey={process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? null} />

      <section>
        <div className="flex items-center justify-between mb-3">
          <h2 className="text-sm font-semibold">
            Inbox {unread > 0 && <span className="text-muted-foreground">({unread} unread)</span>}
          </h2>
          {unread > 0 && (
            <form action={markAllNotificationsReadAction}>
              <button type="submit" className="text-sm text-primary hover:underline">
                Mark all as read
              </button>
            </form>
          )}
        </div>

        {notifications.length === 0 ? (
          <EmptyState
            icon={Bell}
            title="Nothing yet"
            description="Decisions, meeting invites, agreements to sign and results will appear here."
          />
        ) : (
          <ul className="rounded-lg border border-border bg-surface divide-y divide-border">
            {notifications.map((n) => (
              <li key={n.id} className={cn("flex gap-3 px-4 py-3", !n.readAt && "bg-accent/5")}>
                <span
                  className={cn(
                    "mt-1.5 h-2 w-2 shrink-0 rounded-full",
                    n.readAt ? "bg-transparent" : "bg-accent",
                  )}
                />
                <div className="flex-1 min-w-0">
                  {n.url ? (
                    <Link href={n.url} className="text-sm font-medium text-primary hover:underline">
                      {n.title}
                    </Link>
                  ) : (
                    <p className="text-sm font-medium">{n.title}</p>
                  )}
                  <p className="text-sm text-muted-foreground text-justify">{n.body}</p>
                  <p className="text-xs text-muted-foreground mt-1">{fmtDateTime(n.createdAt)} EAT</p>
                </div>
                {!n.readAt && (
                  <form action={markNotificationReadAction.bind(null, n.id)}>
                    <button type="submit" className="text-xs text-muted-foreground hover:text-foreground whitespace-nowrap">
                      Mark read
                    </button>
                  </form>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
