"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Eraser, Fingerprint, PenLine, ScanFace } from "lucide-react";
import { signAgreementAction, type FormState } from "@/lib/actions/agreements";
import { passkeyVerifyOptionsAction } from "@/lib/actions/passkeys";
import { assertPasskey, describePasskeyError, passkeysSupported } from "@/lib/webauthn-client";
import { FormMessage, SubmitButton, inputClass } from "@/components/ui/form";

/**
 * Finger or mouse signature pad. Draws in device pixels (so the stroke stays
 * sharp on phones) and exports a transparent PNG data URL into a hidden
 * input when the stroke ends.
 */
function SignaturePad({ onChange }: { onChange: (dataUrl: string) => void }) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const drawing = useRef(false);
  const hasInk = useRef(false);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ratio = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = rect.width * ratio;
    canvas.height = rect.height * ratio;
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    ctx.scale(ratio, ratio);
    ctx.lineWidth = 2.2;
    ctx.lineCap = "round";
    ctx.lineJoin = "round";
    ctx.strokeStyle = "#0f2647";
  }, []);

  function point(e: React.PointerEvent<HTMLCanvasElement>) {
    const rect = e.currentTarget.getBoundingClientRect();
    return { x: e.clientX - rect.left, y: e.clientY - rect.top };
  }

  function start(e: React.PointerEvent<HTMLCanvasElement>) {
    e.currentTarget.setPointerCapture(e.pointerId);
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    drawing.current = true;
    const p = point(e);
    ctx.beginPath();
    ctx.moveTo(p.x, p.y);
    ctx.lineTo(p.x + 0.1, p.y + 0.1);
    ctx.stroke();
  }

  function move(e: React.PointerEvent<HTMLCanvasElement>) {
    if (!drawing.current) return;
    const ctx = e.currentTarget.getContext("2d");
    if (!ctx) return;
    const p = point(e);
    ctx.lineTo(p.x, p.y);
    ctx.stroke();
    hasInk.current = true;
  }

  function end() {
    if (!drawing.current) return;
    drawing.current = false;
    if (hasInk.current && canvasRef.current) onChange(canvasRef.current.toDataURL("image/png"));
  }

  function clear() {
    const canvas = canvasRef.current;
    const ctx = canvas?.getContext("2d");
    if (!canvas || !ctx) return;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    hasInk.current = false;
    onChange("");
  }

  return (
    <div>
      <div className="relative rounded-md border border-border bg-white">
        <canvas
          ref={canvasRef}
          className="block h-40 w-full touch-none cursor-crosshair"
          onPointerDown={start}
          onPointerMove={move}
          onPointerUp={end}
          onPointerLeave={end}
          onPointerCancel={end}
          aria-label="Signature area: draw your signature with a finger or mouse"
        />
        <div className="pointer-events-none absolute bottom-8 left-6 right-6 border-b border-dashed border-border" />
      </div>
      <button
        type="button"
        onClick={clear}
        className="mt-2 inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
      >
        <Eraser className="h-4 w-4" /> Clear signature
      </button>
    </div>
  );
}

export function SignAgreementForm({
  templateId,
  expectedName,
  hasPasskey,
}: {
  templateId: string;
  expectedName: string;
  hasPasskey: boolean;
}) {
  const [state, action] = useActionState<FormState, FormData>(signAgreementAction, {});
  const [signature, setSignature] = useState("");
  const [passkey, setPasskey] = useState({ challengeId: "", response: "" });
  const [deviceError, setDeviceError] = useState<string | null>(null);
  const [deviceBusy, setDeviceBusy] = useState(false);
  const [canUseDevice, setCanUseDevice] = useState(false);
  const [apple, setApple] = useState(false);
  const formRef = useRef<HTMLFormElement>(null);

  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- browser capability, known only after mount
    setCanUseDevice(hasPasskey && passkeysSupported());
    setApple(/iPhone|iPad|Macintosh/.test(navigator.userAgent));
  }, [hasPasskey]);

  // Once the device has answered, submit with its proof instead of a password.
  useEffect(() => {
    if (passkey.response) formRef.current?.requestSubmit();
  }, [passkey]);

  // A proof is single-use: after any reply from the server, clear it so a
  // retry (or a password attempt) never resends a spent one.
  useEffect(() => {
    // eslint-disable-next-line react-hooks/set-state-in-effect -- reset after the server answered
    setPasskey({ challengeId: "", response: "" });
  }, [state]);

  async function confirmWithDevice() {
    const form = formRef.current;
    if (!form) return;
    // Let the browser flag missing name/consent before prompting for Face ID.
    const password = form.elements.namedItem("password") as HTMLInputElement | null;
    password?.removeAttribute("required");
    if (!form.reportValidity()) return;
    setDeviceError(null);
    setDeviceBusy(true);
    try {
      const opts = await passkeyVerifyOptionsAction();
      if ("error" in opts && opts.error) throw new Error(opts.error);
      if (!("options" in opts) || !opts.options || !opts.challengeId) throw new Error("Could not start.");
      const response = await assertPasskey(opts.options);
      setPasskey({ challengeId: opts.challengeId, response: JSON.stringify(response) });
    } catch (e) {
      setDeviceError(describePasskeyError(e));
    } finally {
      setDeviceBusy(false);
    }
  }

  const DeviceIcon = apple ? ScanFace : Fingerprint;

  return (
    <form ref={formRef} action={action} className="space-y-4">
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="signatureImage" value={signature} />
      <input type="hidden" name="passkeyChallengeId" value={passkey.challengeId} />
      <input type="hidden" name="passkeyResponse" value={passkey.response} />

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="signedName">
          Full name
        </label>
        <input
          id="signedName"
          name="signedName"
          required
          autoComplete="name"
          placeholder={expectedName}
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground mt-1">Type it exactly as registered: {expectedName}</p>
      </div>

      <div>
        <p className="block text-sm font-medium mb-1">Signature</p>
        <SignaturePad onChange={setSignature} />
      </div>

      <div>
        <label className="block text-sm font-medium mb-1" htmlFor="password">
          {canUseDevice ? "Or confirm with your KASI password" : "KASI password"}
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required={!canUseDevice}
          autoComplete="current-password"
          className={inputClass}
        />
        <p className="text-xs text-muted-foreground mt-1">
          Confirms it is you signing, not someone using your unlocked device.
        </p>
      </div>

      <label className="flex items-start gap-2 text-sm text-justify">
        <input type="checkbox" name="consent" required className="mt-1" />
        <span>
          I have read this agreement in full, I understand it, and I sign it freely. I agree that
          this electronic signature binds me as a handwritten one would.
        </span>
      </label>

      <FormMessage error={state.error ?? deviceError ?? undefined} />
      <div className="flex flex-wrap gap-3">
        {canUseDevice && (
          <button
            type="button"
            onClick={confirmWithDevice}
            disabled={deviceBusy}
            className="inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50"
          >
            <DeviceIcon className="h-4 w-4" />
            {deviceBusy ? "Waiting for your device…" : apple ? "Sign with Face ID" : "Sign with fingerprint"}
          </button>
        )}
        <SubmitButton pendingLabel="Signing…" variant={canUseDevice ? "secondary" : "primary"}>
          <PenLine className="h-4 w-4" /> {canUseDevice ? "Sign with password" : "Sign agreement"}
        </SubmitButton>
      </div>
    </form>
  );
}
