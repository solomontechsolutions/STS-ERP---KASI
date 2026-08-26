import type { LucideIcon } from "lucide-react";
import { EmptyState } from "@/components/ui/empty-state";

export function ModulePlaceholder({
  icon,
  title,
  phase,
}: {
  icon: LucideIcon;
  title: string;
  phase: string;
}) {
  return (
    <div>
      <h1 className="text-2xl font-heading font-bold mb-6">{title}</h1>
      <EmptyState
        icon={icon}
        title="Not built yet"
        description={`This module is scoped for ${phase} of the KASI build plan and hasn't been implemented. Nothing here is placeholder data — there's simply nothing to show yet.`}
      />
    </div>
  );
}
