"use client";

import { useEffect, useState, useTransition } from "react";
import { Bell, BellOff, Smartphone, Share, PlusSquare } from "lucide-react";
import {
  removePushSubscriptionAction,
  savePushSubscriptionAction,
  sendTestPushAction,
} from "@/lib/actions/notifications";

function urlBase64ToUint8Array(base64String: string) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = window.atob(base64);
  const out = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; ++i) out[i] = raw.charCodeAt(i);
  return out;
}

type Env = {
  supported: boolean;
  isIOS: boolean;
  standalone: boolean;
  permission: NotificationPermission | "unsupported";
};

/**
 * Turns Web Push on or off for this device.
 *
 * iPhone and iPad only allow push for web apps that have been added to the
 * home screen (iOS 16.4 or later), and only after a tap on a button inside
 * that installed app. So on iOS in a normal Safari tab this shows the
 * install steps instead of an Enable button.
 */
export function PushSettings({ vapidPublicKey }: { vapidPublicKey: string | null }) {
  const [env, setEnv] = useState<Env | null>(null);
  const [subscription, setSubscription] = useState<PushSubscription | null>(null);
  const [message, setMessage] = useState<string | null>(null);
  const [pending, startTransition] = useTransition();

  useEffect(() => {
    const ua = navigator.userAgent;
    const isIOS =
      /iPad|iPhone|iPod/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1);
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    const supported =
      "serviceWorker" in navigator && "PushManager" in window && "Notification" in window;
    // Browser capabilities are only knowable after mount.
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setEnv({
      supported,
      isIOS,
      standalone,
      permission: "Notification" in window ? Notification.permission : "unsupported",
    });
    if (supported) {
      navigator.serviceWorker.ready
        .then((reg) => reg.pushManager.getSubscription())
        .then(setSubscription)
        .catch(() => setSubscription(null));
    }
  }, []);

  function enable() {
    setMessage(null);
    startTransition(async () => {
      try {
        if (!vapidPublicKey) throw new Error("Push is not configured on the server yet.");
        const permission = await Notification.requestPermission();
        setEnv((e) => (e ? { ...e, permission } : e));
        if (permission !== "granted") {
          throw new Error(
            "Notifications were blocked. Allow them for KASI in your phone or browser settings, then try again.",
          );
        }
        const reg = await navigator.serviceWorker.ready;
        const sub =
          (await reg.pushManager.getSubscription()) ??
          (await reg.pushManager.subscribe({
            userVisibleOnly: true,
            applicationServerKey: urlBase64ToUint8Array(vapidPublicKey),
          }));
        await savePushSubscriptionAction(JSON.parse(JSON.stringify(sub)), navigator.userAgent);
        setSubscription(sub);
        await sendTestPushAction();
        setMessage("Notifications are on for this device. A test notification is on its way.");
      } catch (error) {
        setMessage(error instanceof Error ? error.message : "Could not enable notifications.");
      }
    });
  }

  function disable() {
    setMessage(null);
    startTransition(async () => {
      if (subscription) {
        await removePushSubscriptionAction(subscription.endpoint);
        await subscription.unsubscribe().catch(() => undefined);
      }
      setSubscription(null);
      setMessage("Notifications are off for this device.");
    });
  }

  if (!env) return null;

  const needsInstall = env.isIOS && !env.standalone;

  return (
    <section className="rounded-lg border border-border bg-surface p-5">
      <div className="flex items-start gap-3">
        <Smartphone className="h-5 w-5 text-primary mt-0.5 shrink-0" />
        <div className="flex-1 min-w-0">
          <h2 className="text-sm font-semibold">Phone notifications</h2>
          <p className="text-sm text-muted-foreground mt-1 text-justify">
            Get alerts on this device for new decisions to vote on, meeting invites and
            reminders, agreements to sign and results. Turn it on separately on each phone or
            computer you use.
          </p>

          {needsInstall ? (
            <div className="mt-4 rounded-md bg-background p-4 text-sm space-y-2">
              <p className="font-medium">On iPhone or iPad, install KASI first:</p>
              <ol className="list-decimal pl-5 space-y-1 text-muted-foreground">
                <li>
                  Open KASI in <strong>Safari</strong>.
                </li>
                <li className="flex-wrap">
                  Tap <Share className="inline h-4 w-4 align-text-bottom" /> <strong>Share</strong>,
                  then <PlusSquare className="inline h-4 w-4 align-text-bottom" />{" "}
                  <strong>Add to Home Screen</strong>.
                </li>
                <li>Open KASI from the new home screen icon and come back to this page.</li>
              </ol>
              <p className="text-xs text-muted-foreground">Requires iOS 16.4 or later.</p>
            </div>
          ) : !env.supported ? (
            <p className="mt-4 text-sm text-status-warning">
              This browser does not support push notifications. Use Chrome on Android, or Safari
              on iPhone after adding KASI to the home screen.
            </p>
          ) : !vapidPublicKey ? (
            <p className="mt-4 text-sm text-status-warning">
              Push is not configured on the server yet (VAPID keys are missing). Notifications
              still appear in the KASI inbox below.
            </p>
          ) : (
            <div className="mt-4 flex flex-wrap items-center gap-3">
              {subscription ? (
                <>
                  <span className="inline-flex items-center gap-1.5 rounded-full bg-status-success/10 px-2.5 py-1 text-xs font-medium text-status-success">
                    <Bell className="h-3.5 w-3.5" /> On for this device
                  </span>
                  <button
                    type="button"
                    onClick={() => startTransition(async () => { await sendTestPushAction(); setMessage("Test sent."); })}
                    disabled={pending}
                    className="rounded-md border border-border px-3 py-1.5 text-sm hover:bg-background disabled:opacity-50"
                  >
                    Send test
                  </button>
                  <button
                    type="button"
                    onClick={disable}
                    disabled={pending}
                    className="inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-sm text-muted-foreground hover:text-foreground disabled:opacity-50"
                  >
                    <BellOff className="h-4 w-4" /> Turn off
                  </button>
                </>
              ) : (
                <button
                  type="button"
                  onClick={enable}
                  disabled={pending || env.permission === "denied"}
                  className="inline-flex items-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
                >
                  <Bell className="h-4 w-4" /> Enable notifications
                </button>
              )}
              {env.permission === "denied" && (
                <p className="text-sm text-status-warning w-full">
                  Notifications are blocked for KASI. Allow them in your browser or phone
                  settings, then reload.
                </p>
              )}
            </div>
          )}
          {message && <p className="mt-3 text-sm">{message}</p>}
        </div>
      </div>
    </section>
  );
}
