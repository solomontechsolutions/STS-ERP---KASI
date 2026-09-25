import { cn } from "@/lib/cn";

const TONES = {
  success: "bg-status-success/10 text-status-success",
  warning: "bg-status-warning/10 text-status-warning",
  danger: "bg-status-danger/10 text-status-danger",
  info: "bg-accent/15 text-teal",
  neutral: "bg-background text-muted-foreground border border-border",
} as const;

export type BadgeTone = keyof typeof TONES;

export function Badge({
  tone = "neutral",
  children,
  className,
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium whitespace-nowrap",
        TONES[tone],
        className,
      )}
    >
      {children}
    </span>
  );
}

export function statusTone(status: string): BadgeTone {
  switch (status.toLowerCase()) {
    case "completed":
    case "passed":
    case "signed":
    case "ended":
    case "success":
      return "success";
    case "pending":
    case "inprogress":
    case "open":
    case "scheduled":
    case "running":
      return "info";
    case "rejected":
    case "failed":
    case "cancelled":
    case "usercanceled":
      return "danger";
    default:
      return "neutral";
  }
}
