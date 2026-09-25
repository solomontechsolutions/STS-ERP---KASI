"use client";

import { useActionState, useEffect, useRef, useState } from "react";
import { Eraser, PenLine } from "lucide-react";
import { signAgreementAction, type FormState } from "@/lib/actions/agreements";
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
}: {
  templateId: string;
  expectedName: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(signAgreementAction, {});
  const [signature, setSignature] = useState("");

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="templateId" value={templateId} />
      <input type="hidden" name="signatureImage" value={signature} />

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
          KASI password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          required
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

      <FormMessage error={state.error} />
      <SubmitButton pendingLabel="Signing…">
        <PenLine className="h-4 w-4" /> Sign agreement
      </SubmitButton>
    </form>
  );
}
