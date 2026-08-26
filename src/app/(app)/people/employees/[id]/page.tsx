import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { getVisibleEmployee, canViewCompensation } from "@/lib/hr";
import { userHasPermission } from "@/lib/permissions";
import { DocumentList } from "@/components/documents/DocumentList";
import { UploadForm } from "@/components/documents/UploadForm";
import { uploadDocumentAction } from "@/lib/actions/documents";

function Field({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  );
}

export default async function EmployeeDetailPage({
  params,
}: PageProps<"/people/employees/[id]">) {
  const { id } = await params;
  const session = await auth();
  if (!session?.user) redirect("/login");

  const employee = await getVisibleEmployee(session.user.id, id);
  if (!employee) notFound();

  const [showCompensation, canUpload] = await Promise.all([
    canViewCompensation(session.user.id, employee),
    userHasPermission(session.user.id, "documents", "upload"),
  ]);

  const boundUpload = uploadDocumentAction.bind(
    null,
    "employee",
    employee.id,
    `/people/employees/${employee.id}`,
  );

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-heading font-bold mb-1">{employee.fullName}</h1>
      <p className="text-sm text-muted-foreground mb-6">
        {employee.jobTitle} · {employee.employeeNumber}
      </p>

      <section className="rounded-lg border border-border bg-surface p-5 mb-8">
        <h2 className="text-sm font-semibold mb-4">Details</h2>
        <div className="grid grid-cols-2 gap-4">
          <Field label="Department" value={employee.department} />
          <Field label="Site" value={employee.site ?? "—"} />
          <Field
            label="Employment status"
            value={<span className="capitalize">{employee.employmentStatus.replace("_", " ")}</span>}
          />
          <Field
            label="Date joined"
            value={
              employee.dateJoined
                ? employee.dateJoined.toLocaleDateString("en-GB", {
                    day: "2-digit",
                    month: "short",
                    year: "numeric",
                  })
                : "Not recorded"
            }
          />
          <Field label="Reports to" value={employee.reportsTo ?? "—"} />
          <Field label="Leave entitlement" value={`${employee.leaveEntitlementDays} days / year`} />
          {showCompensation && (
            <Field
              label="Gross salary"
              value={
                employee.grossSalary
                  ? `TZS ${Number(employee.grossSalary).toLocaleString("en-TZ")} / month`
                  : "Not recorded"
              }
            />
          )}
        </div>
      </section>

      <section>
        <h2 className="text-sm font-semibold mb-4">Documents</h2>
        {canUpload && (
          <div className="mb-4">
            <UploadForm
              action={boundUpload}
              categories={["contract", "id_document", "certificate", "other"]}
            />
          </div>
        )}
        <DocumentList entityType="employee" entityId={employee.id} />
      </section>
    </div>
  );
}
