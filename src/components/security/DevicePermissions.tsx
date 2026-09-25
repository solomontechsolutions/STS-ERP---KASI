"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Bell, Camera, Fingerprint, MapPin, Mic, Smartphone } from "lucide-react";
import { deviceUnlockAvailable } from "@/lib/webauthn-client";
import { Badge, type BadgeTone } from "@/components/ui/badge";

type Status = { tone: BadgeTone; label: string };

async function queryPermission(name: string): Promise<PermissionState | "unknown"> {
  try {
    const result = await navigator.permissions.query({ name: name as PermissionName });
    return result.state;
  } catch {
    return "unknown"; // Safari and Firefox don't expose every permission
  }
}

function permissionStatus(state: PermissionState | "unknown"): Status {
  if (state === "granted") return { tone: "success", label: "Allowed" };
  if (state === "denied") return { tone: "danger", label: "Blocked" };
  if (state === "prompt") return { tone: "neutral", label: "Asks when needed" };
  return { tone: "neutral", label: "Asks when needed" };
}

/**
 * What this phone or computer lets KASI use, with a way to grant or test
 * each. Browsers only let a site ASK for a permission; changing one that
 * was blocked happens in the phone's Settings, which the rows explain.
 */
export function DevicePermissions() {
  const [unlock, setUnlock] = useState<Status | null>(null);
  const [installed, setInstalled] = useState<Status | null>(null);
  const [notify, setNotify] = useState<Status | null>(null);
  const [camera, setCamera] = useState<Status | null>(null);
  const [mic, setMic] = useState<Status | null>(null);
  const [testing, setTesting] = useState(false);
  const [testError, setTestError] = useState<string | null>(null);
  const videoRef = useRef<HTMLVideoElement>(null);

  async function refresh() {
    setUnlock(
      (await deviceUnlockAvailable())
        ? { tone: "success", label: "Available" }
        : { tone: "warning", label: "Not set up on this device" },
    );
    const standalone =
      window.matchMedia("(display-mode: standalone)").matches ||
      (navigator as Navigator & { standalone?: boolean }).standalone === true;
    setInstalled(standalone ? { tone: "success", label: "Installed app" } : { tone: "neutral", label: "In browser" });
    setNotify(
      !("Notification" in window)
        ? { tone: "neutral", label: "Not supported here" }
        : Notification.permission === "granted"
          ? { tone: "success", label: "Allowed" }
          : Notification.permission === "denied"
            ? { tone: "danger", label: "Blocked" }
            : { tone: "neutral", label: "Not asked yet" },
    );
    setCamera(permissionStatus(await queryPermission("camera")));
    setMic(permissionStatus(await queryPermission("microphone")));
  }

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reads browser permission state
    void refresh();
  }, []);

  async function testCameraAndMic() {
    setTestError(null);
    setTesting(true);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
      if (videoRef.current) videoRef.current.srcObject = stream;
      setTimeout(() => {
        stream.getTracks().forEach((t) => t.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
        setTesting(false);
        void refresh();
      }, 4000);
    } catch (e) {
      setTesting(false);
      setTestError(
        (e as { name?: string }).name === "NotAllowedError"
          ? "Camera or microphone is blocked. Allow them for KASI in your phone's Settings (iPhone: Settings, Safari, Camera and Microphone; Android: tap the lock icon by the address)."
          : "No camera or microphone was found.",
      );
      void refresh();
    }
  }

  const rows: { icon: typeof Bell; title: string; detail: string; status: Status | null; action?: React.ReactNode }[] = [
    {
      icon: Fingerprint,
      title: "Face ID, Touch ID or fingerprint",
      detail: "Used to sign in, unlock KASI and confirm signatures.",
      status: unlock,
    },
    {
      icon: Smartphone,
      title: "Installed as an app",
      detail: "Needed on iPhone for notifications. Opens full screen with its own icon.",
      status: installed,
    },
    {
      icon: Bell,
      title: "Notifications",
      detail: "Decisions to vote on, meetings, agreements and results.",
      status: notify,
      action: <Link href="/notifications" className="text-[15px] font-medium text-primary">Manage</Link>,
    },
    {
      icon: Camera,
      title: "Camera",
      detail: "Only for video meetings.",
      status: camera,
    },
    {
      icon: Mic,
      title: "Microphone",
      detail: "Only for video meetings.",
      status: mic,
      action: (
        <button type="button" onClick={testCameraAndMic} disabled={testing} className="text-[15px] font-medium text-primary disabled:opacity-50">
          {testing ? "Testing…" : "Test"}
        </button>
      ),
    },
    {
      icon: MapPin,
      title: "Location",
      detail: "KASI never asks for your location.",
      status: { tone: "neutral", label: "Not used" },
    },
  ];

  return (
    <div>
      <ul className="divide-y divide-border">
        {rows.map((r) => (
          <li key={r.title} className="flex items-center gap-3 py-3">
            <span className="grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-primary/[0.08] text-primary">
              <r.icon className="h-[18px] w-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium">{r.title}</span>
              <span className="block text-[13px] text-muted-foreground">{r.detail}</span>
            </span>
            <span className="flex shrink-0 flex-col items-end gap-1 sm:flex-row sm:items-center sm:gap-3">
              {r.status && <Badge tone={r.status.tone}>{r.status.label}</Badge>}
              {r.action}
            </span>
          </li>
        ))}
      </ul>
      {testing && (
        <video ref={videoRef} autoPlay muted playsInline className="mt-3 w-full max-w-xs rounded-2xl bg-black" />
      )}
      {testError && <p className="mt-3 text-sm text-status-danger text-justify">{testError}</p>}
    </div>
  );
}
