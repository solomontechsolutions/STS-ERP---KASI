"use client";

import { useState, useTransition } from "react";
import { setUserRoleAction, setUserActiveAction } from "@/lib/actions/access";
import { cn } from "@/lib/cn";

type RoleOption = { id: string; label: string };
type UserRow = {
  id: string;
  name: string;
  email: string;
  isActive: boolean;
  mustResetPassword: boolean;
  roleIds: string[];
};

export function AccessTable({
  users,
  roles,
  canEdit,
}: {
  users: UserRow[];
  roles: RoleOption[];
  canEdit: boolean;
}) {
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  function run(action: () => Promise<void>) {
    setError(null);
    startTransition(async () => {
      try {
        await action();
      } catch (err) {
        setError(err instanceof Error ? err.message : "Action failed");
      }
    });
  }

  return (
    <div>
      {error && (
        <p className="mb-3 rounded-md bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
          {error}
        </p>
      )}
      <div className="overflow-x-auto rounded-lg border border-border bg-surface">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
              <th className="px-4 py-3 font-medium">User</th>
              <th className="px-4 py-3 font-medium">Status</th>
              {roles.map((r) => (
                <th key={r.id} className="px-3 py-3 font-medium text-center">
                  {r.label}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {users.map((u) => (
              <tr key={u.id} className="border-b border-border last:border-0">
                <td className="px-4 py-3">
                  <p className="font-medium">{u.name}</p>
                  <p className="text-xs text-muted-foreground">{u.email}</p>
                </td>
                <td className="px-4 py-3">
                  <button
                    type="button"
                    disabled={!canEdit || isPending}
                    onClick={() => run(() => setUserActiveAction(u.id, !u.isActive))}
                    className={cn(
                      "rounded-full px-2 py-0.5 text-xs font-medium",
                      u.isActive
                        ? "bg-status-success/10 text-status-success"
                        : "bg-status-danger/10 text-status-danger",
                      canEdit && "cursor-pointer",
                    )}
                  >
                    {u.isActive ? "Active" : "Inactive"}
                  </button>
                  {u.mustResetPassword && (
                    <p className="mt-1 text-[11px] text-muted-foreground">Pending first login</p>
                  )}
                </td>
                {roles.map((r) => {
                  const checked = u.roleIds.includes(r.id);
                  return (
                    <td key={r.id} className="px-3 py-3 text-center">
                      <input
                        type="checkbox"
                        checked={checked}
                        disabled={!canEdit || isPending}
                        onChange={(e) =>
                          run(() => setUserRoleAction(u.id, r.id, e.target.checked))
                        }
                        className="h-4 w-4 accent-primary"
                      />
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
