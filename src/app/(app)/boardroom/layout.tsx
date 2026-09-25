import { redirect } from "next/navigation";
import { Gavel } from "lucide-react";
import { auth } from "@/auth";
import { isBoardMember } from "@/lib/boardroom/members";
import { EmptyState } from "@/components/ui/empty-state";

/** The Boardroom is for founders only: holders of a Director or Shareholder record. */
export default async function BoardroomLayout({ children }: LayoutProps<"/boardroom">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  if (!(await isBoardMember(session.user.id))) {
    return (
      <EmptyState
        icon={Gavel}
        title="Founders only"
        description="The Boardroom is open to directors and shareholders of Solomon Tech Solutions."
      />
    );
  }
  return children;
}
