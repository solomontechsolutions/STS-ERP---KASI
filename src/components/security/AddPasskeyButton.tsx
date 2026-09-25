"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Fingerprint, Plus, ScanFace } from "lucide-react";
import { passkeyRegistrationOptionsAction, registerPasskeyAction } from "@/lib/actions/passkeys";
import { createPasskey, describePasskeyError, passkeysSupported } from "@/lib/webauthn-client";

function guessDeviceName() {
  const ua = navigator.userAgent;
  if (/iPhone/.test(ua)) return "iPhone";
  if (/iPad/.test(ua) || (ua.includes("Macintosh") && navigator.maxTouchPoints > 1)) return "iPad";
  if (/Macintosh/.test(ua)) return "Mac";
  if (/Android/.test(ua)) return "Android phone";
  if (/Windows/.test(ua)) return "Windows PC";
  return "This device";
}

export function AddPasskeyButton({ primary = true }: { primary?: boolean }) {
  const router = useRouter();
  const [supported, setSupported] = useState(true);
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ tone: "ok" | "error"; text: string } | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability, known only after mount
    setSupported(passkeysSupported());
    setApple(/iPhone|iPad|Macintosh/.test(navigator.userAgent));
  }, []);

  async function add() {
    setBusy(true);
    setMessage(null);
    try {
      const { challengeId, options } = await passkeyRegistrationOptionsAction();
      const response = await createPasskey(options);
      const result = await registerPasskeyAction(challengeId, response, guessDeviceName());
      if (result.error) setMessage({ tone: "error", text: result.error });
      else {
        setMessage({ tone: "ok", text: "Done. You can now sign in and unlock KASI with this device." });
        router.refresh();
      }
    } catch (e) {
      const text = describePasskeyError(e);
      if (text) setMessage({ tone: "error", text });
    } finally {
      setBusy(false);
    }
  }

  if (!supported) {
    return <p className="text-sm text-status-warning">This browser does not support passkeys. Update it, or use Safari on iPhone or Chrome on Android.</p>;
  }
  const Icon = apple ? ScanFace : Fingerprint;
  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={add}
        disabled={busy}
        className={
          primary
            ? "inline-flex items-center gap-2 rounded-xl bg-primary px-4 py-2.5 text-sm font-semibold text-primary-foreground transition hover:opacity-95 active:scale-[0.99] disabled:opacity-60"
            : "inline-flex items-center gap-2 rounded-xl border border-border bg-surface px-4 py-2.5 text-sm font-medium hover:bg-background disabled:opacity-60"
        }
      >
        {primary ? <Icon className="h-4 w-4" /> : <Plus className="h-4 w-4" />}
        {busy ? "Follow the prompt on your device…" : primary ? `Set up ${apple ? "Face ID or Touch ID" : "fingerprint or face unlock"} on this device` : "Add another device"}
      </button>
      {message && (
        <p className={`text-sm ${message.tone === "ok" ? "text-status-success" : "text-status-danger"}`}>{message.text}</p>
      )}
    </div>
  );
}
