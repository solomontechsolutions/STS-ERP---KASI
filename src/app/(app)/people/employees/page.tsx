import Link from "next/link";
import { Users } from "lucide-react";
import { redirect } from "next/navigation";
import { auth } from "@/auth";
import { userHasPermission } from "@/lib/permissions";
import { getVisibleEmployees } from "@/lib/hr";
import { EmptyState } from "@/components/ui/empty-state";

export default async function EmployeesPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const canView = await userHasPermission(session.user.id, "hr", "view");
  if (!canView) {
    return (
      <EmptyState
        icon={Users}
        title="No access"
        description="Your account doesn't hold a role with HR visibility."
      />
    );
  }

  const employees = await getVisibleEmployees(session.user.id);

  return (
    <div>
      <h1 className="text-2xl font-heading font-bold mb-6">Employees</h1>

      {employees.length === 0 ? (
        <EmptyState
          icon={Users}
          title="No employees yet"
          description="No employee records are visible to your account."
        />
      ) : (
        <div className="overflow-x-auto rounded-lg border border-border bg-surface">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="px-4 py-3 font-medium">Name</th>
                <th className="px-4 py-3 font-medium">Job title</th>
                <th className="px-4 py-3 font-medium">Department</th>
                <th className="px-4 py-3 font-medium">Site</th>
                <th className="px-4 py-3 font-medium">Status</th>
              </tr>
            </thead>
            <tbody>
              {employees.map((e) => (
                <tr key={e.id} className="border-b border-border last:border-0 hover:bg-background/60">
                  <td className="px-4 py-3">
                    <Link
                      href={`/people/employees/${e.id}`}
                      className="font-medium text-primary hover:underline"
                    >
                      {e.fullName}
                    </Link>
                    <p className="text-xs text-muted-foreground">{e.employeeNumber}</p>
                  </td>
                  <td className="px-4 py-3">{e.jobTitle}</td>
                  <td className="px-4 py-3">{e.department}</td>
                  <td className="px-4 py-3">{e.site ?? "—"}</td>
                  <td className="px-4 py-3">
                    <span className="inline-flex items-center rounded-full bg-status-success/10 px-2 py-0.5 text-xs font-medium text-status-success capitalize">
                      {e.employmentStatus.replace("_", " ")}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
