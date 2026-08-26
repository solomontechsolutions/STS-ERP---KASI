import { redirect } from "next/navigation";
import { Building2 } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { userHasPermission } from "@/lib/permissions";
import { EmptyState } from "@/components/ui/empty-state";
import { updateCompanyAction } from "@/lib/actions/company";

function ReadOnlyField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs uppercase tracking-wider text-muted-foreground">{label}</p>
      <p className="text-sm mt-0.5">{value}</p>
    </div>
  );
}

export default async function CompanySettingsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const [canView, canEdit, company] = await Promise.all([
    userHasPermission(session.user.id, "settings", "view"),
    userHasPermission(session.user.id, "settings", "edit"),
    prisma.company.findFirst(),
  ]);

  if (!canView) {
    return (
      <EmptyState
        icon={Building2}
        title="No access"
        description="Your account doesn't hold a role with Settings visibility."
      />
    );
  }

  if (!company) {
    return (
      <EmptyState
        icon={Building2}
        title="No company record"
        description="Run the seed script (npm run db:seed) to create the STS company record."
      />
    );
  }

  const activities = Array.isArray(company.businessActivities)
    ? (company.businessActivities as { code: string; description: string }[])
    : [];

  return (
    <div className="max-w-3xl">
      <h1 className="text-2xl font-heading font-bold mb-6">Company</h1>

      <section className="rounded-lg border border-border bg-surface p-5 mb-6">
        <h2 className="text-sm font-semibold mb-4">Registration (BRELA/TRA — not editable here)</h2>
        <div className="grid grid-cols-2 gap-4">
          <ReadOnlyField label="Legal name" value={company.legalName} />
          <ReadOnlyField label="BRELA number" value={company.brelaNumber} />
          <ReadOnlyField label="TIN" value={company.tin} />
          <ReadOnlyField
            label="Incorporation date"
            value={company.incorporationDate.toLocaleDateString("en-GB", {
              day: "2-digit",
              month: "short",
              year: "numeric",
            })}
          />
          <ReadOnlyField
            label="Share capital"
            value={`TZS ${Number(company.shareCapitalAmount).toLocaleString("en-TZ")}`}
          />
          <ReadOnlyField
            label="Shares"
            value={`${company.totalShares} @ TZS ${Number(company.parValuePerShare).toLocaleString("en-TZ")}`}
          />
        </div>
        {activities.length > 0 && (
          <div className="mt-4">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
              Registered business activities
            </p>
            <ul className="text-sm space-y-0.5">
              {activities.map((a) => (
                <li key={a.code}>
                  {a.code} — {a.description}
                </li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold mb-4">Administrative details</h2>
        {canEdit ? (
          <form action={updateCompanyAction} className="space-y-4">
            <div>
              <label className="block text-sm font-medium mb-1">Legal name</label>
              <input
                name="legalName"
                defaultValue={company.legalName}
                required
                className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Trading name</label>
              <input
                name="tradingName"
                defaultValue={company.tradingName ?? ""}
                className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Registered office address</label>
              <input
                name="registeredOfficeAddress"
                defaultValue={company.registeredOfficeAddress}
                required
                className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-sm font-medium mb-1">P.O. Box</label>
                <input
                  name="poBox"
                  defaultValue={company.poBox ?? ""}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
              <div>
                <label className="block text-sm font-medium mb-1">Tax office</label>
                <input
                  name="taxOffice"
                  defaultValue={company.taxOffice ?? ""}
                  className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
                />
              </div>
            </div>
            <div>
              <label className="block text-sm font-medium mb-1">Accounting reference date</label>
              <input
                name="accountingReferenceDate"
                defaultValue={company.accountingReferenceDate ?? ""}
                placeholder="e.g. 28 February"
                className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
              />
            </div>
            <button
              type="submit"
              className="rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
            >
              Save changes
            </button>
          </form>
        ) : (
          <div className="grid grid-cols-2 gap-4">
            <ReadOnlyField label="Trading name" value={company.tradingName ?? "—"} />
            <ReadOnlyField label="Registered office" value={company.registeredOfficeAddress} />
            <ReadOnlyField label="P.O. Box" value={company.poBox ?? "—"} />
            <ReadOnlyField label="Tax office" value={company.taxOffice ?? "—"} />
            <ReadOnlyField
              label="Accounting reference date"
              value={company.accountingReferenceDate ?? "—"}
            />
          </div>
        )}
      </section>
    </div>
  );
}
