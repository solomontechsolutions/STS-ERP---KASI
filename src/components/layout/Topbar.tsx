import { signOut } from "@/auth";

export function Topbar({
  userName,
  roleLabels,
}: {
  userName: string;
  roleLabels: string[];
}) {
  return (
    <header className="h-16 shrink-0 border-b border-border bg-surface flex items-center justify-between px-6">
      <div />
      <div className="flex items-center gap-4">
        <div className="text-right">
          <p className="text-sm font-medium leading-tight">{userName}</p>
          <p className="text-xs text-muted-foreground leading-tight">
            {roleLabels.join(" · ") || "No roles assigned"}
          </p>
        </div>
        <form
          action={async () => {
            "use server";
            await signOut({ redirectTo: "/login" });
          }}
        >
          <button
            type="submit"
            className="text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            Sign out
          </button>
        </form>
      </div>
    </header>
  );
}
