import { ClipboardCheck } from "lucide-react";
import { ModulePlaceholder } from "@/components/layout/ModulePlaceholder";

export default function Page() {
  return (
    <ModulePlaceholder icon={ClipboardCheck} title="My Approvals" phase="Phase 4" />
  );
}
