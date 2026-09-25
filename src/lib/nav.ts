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
  Gavel,
  Video,
  FileText,
  ClipboardCheck,
  Settings,
} from "lucide-react";

export type NavItem = {
  label: string;
  href: string;
  /**
   * Who sees the item. A module means "holds module:view". "board" means a
   * founder (a Director or Shareholder record, see lib/boardroom/members.ts),
   * "everyone" means any signed-in user.
   */
  module: Module | "board" | "everyone";
};

export type NavGroup = {
  label: string;
  icon: LucideIcon;
  items: NavItem[];
};

/**
 * The subset of a nav group that may cross the Server -> Client Component
 * boundary. `NavGroup.icon` is a React component, and React cannot serialize
 * a component into a Client Component's props — passing a whole `NavGroup`
 * throws "Functions cannot be passed directly to Client Components" at
 * render time. Keep client props to this shape.
 */
export type SerializableNavGroup = {
  label: string;
  items: NavItem[];
};

/** Whether a user with these grants (and board status) sees a nav item. */
export function canSeeNavItem(
  item: NavItem,
  grants: Set<string>,
  isBoardMember: boolean,
): boolean {
  if (item.module === "everyone") return true;
  if (item.module === "board") return isBoardMember;
  return grants.has(`${item.module}:view`);
}

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
    label: "Boardroom",
    icon: Gavel,
    items: [
      { label: "Board overview", href: "/boardroom", module: "board" },
      { label: "Decisions & votes", href: "/boardroom/decisions", module: "board" },
      { label: "Founder agreements", href: "/boardroom/agreements", module: "board" },
    ],
  },
  {
    label: "Collaborate",
    icon: Video,
    items: [
      { label: "Meetings", href: "/meetings", module: "everyone" },
      { label: "Notifications", href: "/notifications", module: "everyone" },
      { label: "Web & phone preview", href: "/simulator", module: "everyone" },
    ],
  },
  {
    label: "Finance",
    icon: Landmark,
    items: [
      { label: "Accounting", href: "/finance/accounting", module: "finance" },
      { label: "Banking & reconciliation", href: "/finance/banking", module: "banking" },
      { label: "Payroll", href: "/finance/payroll", module: "payroll" },
      { label: "Revenue reports", href: "/finance/reports", module: "banking" },
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
