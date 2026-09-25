"use client";

import { useEffect, useRef } from "react";
import { useFormStatus } from "react-dom";
import { cn } from "@/lib/cn";

export const inputClass =
  "w-full rounded-md border border-border bg-surface px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent";

export function SubmitButton({
  children,
  pendingLabel = "Saving…",
  className,
  variant = "primary",
}: {
  children: React.ReactNode;
  pendingLabel?: string;
  className?: string;
  variant?: "primary" | "secondary" | "danger";
}) {
  const { pending } = useFormStatus();
  return (
    <button
      type="submit"
      disabled={pending}
      className={cn(
        "inline-flex items-center justify-center gap-2 rounded-md px-4 py-2 text-sm font-medium transition-opacity disabled:opacity-50",
        variant === "primary" && "bg-primary text-primary-foreground hover:opacity-90",
        variant === "secondary" && "border border-border bg-surface hover:bg-background",
        variant === "danger" && "bg-status-danger text-white hover:opacity-90",
        className,
      )}
    >
      {pending ? pendingLabel : children}
    </button>
  );
}

export function FormMessage({ error, success }: { error?: string; success?: string }) {
  if (error) {
    return (
      <p role="alert" className="rounded-md bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
        {error}
      </p>
    );
  }
  if (success) {
    return (
      <p role="status" className="rounded-md bg-status-success/10 px-3 py-2 text-sm text-status-success">
        {success}
      </p>
    );
  }
  return null;
}

/**
 * Sends the browser's UTC offset with a form that has a datetime-local
 * input, which carries no time zone of its own. The server adds this offset
 * to turn the wall-clock time the user picked into an exact instant.
 */
export function TzOffsetInput() {
  const ref = useRef<HTMLInputElement>(null);
  useEffect(() => {
    if (ref.current) ref.current.value = String(new Date().getTimezoneOffset());
  }, []);
  // -180 is East Africa Time, the right answer for almost every KASI user
  // until the effect above replaces it with the browser's own offset.
  return <input ref={ref} type="hidden" name="tzOffset" defaultValue="-180" />;
}
