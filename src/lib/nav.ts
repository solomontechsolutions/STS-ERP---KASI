import type { Module } from "@/lib/rbac";
import type { LucideIcon } from "lucide-react";
import {
  LayoutDashboard,
  Landmark,
  Users,
  ShoppingCart,
  Boxes,
  FolderKanban,
  ShieldCheck,
  FileText,
  ClipboardCheck,
  Settings,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  module: Module;
};

export type NavGroup = {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

// Section 13.1 grouping. Modules not yet built (Phase 4+) still appear here
// so the navigation shape is right from day one — each links to a route
// that renders a real "not built yet" empty state rather than 404ing.
export const NAV_GROUPS: NavGroup[] = [
  {
    label: "Overview",
    icon: LayoutDashboard,
    items: [{ label: "Dashboard", href: "/", module: "dashboard" }],
  },
  {
    label: "Finance",
    icon: Landmark,
    items: [
      { label: "Accounting", href: "/finance/accounting", module: "finance" },
      { label: "Banking & reconciliation", href: "/finance/banking", module: "banking" },
      { label: "Payroll", href: "/finance/payroll", module: "payroll" },
      { label: "Reports", href: "/finance/reports", module: "finance" },
    ],
  },
  {
    label: "People",
    icon: Users,
    items: [{ label: "Employees", href: "/people/employees", module: "hr" }],
  },
  {
    label: "Commercial",
    icon: ShoppingCart,
    items: [
      { label: "Subscriber revenue", href: "/commercial/subscribers", module: "sales_subscriber" },
      { label: "Customers & contracts", href: "/commercial/customers", module: "sales_institutional" },
      { label: "Suppliers & purchasing", href: "/commercial/purchasing", module: "purchasing" },
    ],
  },
  {
    label: "Assets",
    icon: Boxes,
    items: [
      { label: "Fixed assets", href: "/assets/register", module: "assets" },
      { label: "Inventory", href: "/assets/inventory", module: "inventory" },
    ],
  },
  {
    label: "Projects",
    icon: FolderKanban,
    items: [{ label: "Projects & sites", href: "/projects", module: "projects" }],
  },
  {
    label: "Governance",
    icon: ShieldCheck,
    items: [
      { label: "Directors & shareholders", href: "/governance/people", module: "governance" },
      { label: "Company records", href: "/governance/records", module: "governance" },
    ],
  },
  {
    label: "Documents",
    icon: FileText,
    items: [{ label: "All documents", href: "/documents", module: "documents" }],
  },
  {
    label: "Approvals",
    icon: ClipboardCheck,
    items: [{ label: "My approvals", href: "/approvals", module: "approvals" }],
  },
  {
    label: "Settings",
    icon: Settings,
    items: [
      { label: "Company", href: "/settings/company", module: "settings" },
      { label: "Users & access", href: "/settings/access", module: "settings" },
    ],
  },
];
