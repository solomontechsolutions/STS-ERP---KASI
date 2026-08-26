// RBAC baseline (Section 6 of the KASI build brief).
//
// A permission is (role × module × verb). Roles are composable bundles a
// user can hold more than one of at a time — e.g. Mathias Silas Kisute holds
// both "director" and "company_secretary"; Allan Silas Kisute and Mathias
// Silas Kisute both hold "finance" (Phase 1 decision, 2026-08-26).
//
// Modules and verbs are plain strings by design (Section 6.2) so new modules
// can be added later without a schema migration.

export const VERBS = [
  "view",
  "create",
  "edit",
  "delete",
  "approve",
  "export",
  "upload",
  "download",
  "finalize",
] as const;
export type Verb = (typeof VERBS)[number];

export const MODULES = [
  "dashboard",
  "finance", // chart of accounts, journal entries, management reports
  "banking", // bank transactions, three-way reconciliation
  "payroll",
  "hr", // employee records, leave, HR documents (excludes compensation figures)
  "hr_compensation", // salary/compensation visibility — gated separately from general HR
  "assets", // fixed asset register
  "inventory",
  "sales_subscriber", // BillNasi/Selcom subscriber revenue ledger
  "sales_institutional", // institutional customers, quotations, contracts
  "purchasing", // suppliers, purchase orders, bills
  "projects",
  "governance", // directors, shareholders, resolutions, minutes, licences
  "documents",
  "approvals",
  "settings",
  "audit",
] as const;
export type Module = (typeof MODULES)[number];

type Grant = { module: Module; verb: Verb };

function all(module: Module, verbs: readonly Verb[] = VERBS): Grant[] {
  return verbs.map((verb) => ({ module, verb }));
}

export const ROLE_DEFINITIONS: Record<
  string,
  { label: string; description: string; permissions: Grant[] }
> = {
  director: {
    label: "Director / Owner",
    description:
      "Full visibility into finance, HR, governance, approvals, assets, projects, documents and reporting. Top-tier approver.",
    permissions: [
      ...all("dashboard", ["view"]),
      ...all("finance"),
      ...all("banking"),
      ...all("payroll", ["view", "approve", "finalize", "export"]),
      ...all("hr"),
      ...all("hr_compensation", ["view"]),
      ...all("assets"),
      ...all("inventory"),
      ...all("sales_subscriber"),
      ...all("sales_institutional"),
      ...all("purchasing", ["view", "create", "edit", "approve", "export"]),
      ...all("projects"),
      ...all("governance", ["view", "approve"]),
      ...all("documents"),
      ...all("approvals"),
      ...all("settings", ["view", "edit", "create"]),
    ],
  },
  company_secretary: {
    label: "Company Secretary",
    description:
      "Additive bundle: create/edit governance records (resolutions, minutes, share register, statutory filings) on behalf of the board.",
    permissions: [...all("governance")],
  },
  finance: {
    label: "Finance",
    description:
      "Full access to chart of accounts, banking, payables/receivables, payroll processing and financial reporting. Assignable to any director or trusted staff member.",
    permissions: [
      ...all("finance"),
      ...all("banking"),
      ...all("payroll"),
      ...all("purchasing"),
      ...all("documents", ["view", "upload", "download"]),
    ],
  },
  hr: {
    label: "HR",
    description:
      "Full access to employee records, leave and HR documents. Salary figures require the separate hr_compensation grant.",
    permissions: [
      ...all("hr"),
      ...all("documents", ["view", "upload", "download"]),
    ],
  },
  management_admin: {
    label: "Management / Admin",
    description:
      "Operational and administrative access to purchasing, inventory, projects and sales/customer records, without governance or full financial visibility unless explicitly granted.",
    permissions: [
      ...all("dashboard", ["view"]),
      ...all("purchasing", ["view", "create", "edit"]),
      ...all("inventory"),
      ...all("sales_subscriber", ["view", "export"]),
      ...all("sales_institutional"),
      ...all("projects"),
      ...all("documents", ["view", "upload", "download"]),
      ...all("approvals", ["view", "create"]),
    ],
  },
  employee: {
    label: "Employee",
    description:
      "Sees and edits only their own HR profile, leave requests and assigned assets, plus whatever operational module their job needs.",
    permissions: [
      ...all("dashboard", ["view"]),
      ...all("hr", ["view"]), // scoped to self at the query layer, not here
      ...all("assets", ["view"]), // scoped to assigned assets at the query layer
      ...all("documents", ["view", "upload", "download"]),
      ...all("approvals", ["view", "create"]),
    ],
  },
};
