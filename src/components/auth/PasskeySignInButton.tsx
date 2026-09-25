"use client";

import { useEffect, useState } from "react";
import { Fingerprint, ScanFace } from "lucide-react";
import { passkeyLoginOptionsAction, passkeySignInAction } from "@/lib/actions/passkeys";
import { assertPasskey, describePasskeyError, passkeysSupported } from "@/lib/webauthn-client";

/** Sign in with Face ID, Touch ID, fingerprint, Windows Hello or device PIN. */
export function PasskeySignInButton({ callbackUrl }: { callbackUrl: string }) {
  const [supported, setSupported] = useState(false);
  const [apple, setApple] = useState(false);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability, known only after mount
    setSupported(passkeysSupported());
    setApple(/iPhone|iPad|Macintosh/.test(navigator.userAgent));
  }, []);

  async function signInWithPasskey() {
    setBusy(true);
    setError(null);
    try {
      const { challengeId, options } = await passkeyLoginOptionsAction();
      const response = await assertPasskey(options);
      const result = await passkeySignInAction(challengeId, response, callbackUrl);
      if (result?.error) setError(result.error);
    } catch (e) {
      setError(describePasskeyError(e));
    } finally {
      setBusy(false);
    }
  }

  if (!supported) return null;
  const Icon = apple ? ScanFace : Fingerprint;

  return (
    <div className="space-y-2">
      <button
        type="button"
        onClick={signInWithPasskey}
        disabled={busy}
        className="flex w-full items-center justify-center gap-2.5 rounded-2xl bg-foreground py-3.5 text-[15px] font-semibold text-white transition active:scale-[0.99] disabled:opacity-60"
      >
        <Icon className="h-5 w-5" />
        {busy ? "Waiting for your device…" : apple ? "Sign in with Face ID or Touch ID" : "Sign in with fingerprint or passkey"}
      </button>
      {error && (
        <p role="alert" className="rounded-xl bg-status-danger/10 px-3 py-2 text-[13px] text-status-danger">
          {error}
        </p>
      )}
    </div>
  );
}
