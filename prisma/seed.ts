/**
 * KASI foundation seed — Company record, RBAC roles/permissions, and the
 * nine confirmed initial users (Section 4 of the build brief), each linked
 * to their Director/Shareholder/Employee identity record.
 *
 * Temporary passwords are generated fresh on every run and printed ONLY to
 * this script's console output (never written to a file, never committed —
 * Section 4's explicit instruction). Every seeded user has
 * mustResetPassword = true, so the printed password is single-use.
 *
 * Run with: npm run db:seed
 */
import { config as loadEnv } from "dotenv";
loadEnv({ path: ".env.local" });
import { randomBytes } from "crypto";
import bcrypt from "bcryptjs";
import { PrismaClient } from "@prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { getRuntimeDatabaseUrl } from "../src/lib/db-url";
import { ROLE_DEFINITIONS } from "../src/lib/rbac";

const adapter = new PrismaPg({ connectionString: getRuntimeDatabaseUrl() });
const prisma = new PrismaClient({ adapter });

function generateTempPassword(): string {
  // 16 random bytes -> base64url, trimmed to a readable 20-char token.
  return randomBytes(16).toString("base64url").slice(0, 20);
}

async function main() {
  // --- Company (Section 3, Phase 1 decisions dated 2026-08-26) -----------
  const existingCompany = await prisma.company.findFirst();
  if (!existingCompany) {
    await prisma.company.create({
      data: {
        legalName: "Solomon Tech Solutions Limited",
        tradingName: "KASI-WIFI",
        brelaNumber: "200629183",
        tin: "200-629-183",
        tinEffectiveDate: new Date("2026-02-25"),
        taxOffice: "Tegeta Tax Centre",
        // Phase 1 decision: certificate date (25 Feb 2026) is authoritative,
        // not the 24 Feb date in the management accounts report.
        incorporationDate: new Date("2026-02-25"),
        // Phase 1 decision: BRELA filing address is authoritative, not the
        // "TAN RE House" address in the management accounts report.
        registeredOfficeAddress:
          "Plot 406, Block 4, Longido Street, Upanga Mashariki, Ilala CBD, Dar es Salaam",
        poBox: "P.O. Box 78176",
        accountingReferenceDate: "28 February",
        shareCapitalAmount: 1_000_000,
        totalShares: 1000,
        parValuePerShare: 1000,
        businessActivities: [
          { code: "6201", description: "Computer programming" },
          { code: "6202", description: "Computer consultancy and computer facilities management" },
          { code: "6209", description: "Other IT and computer service activities" },
          { code: "6399", description: "Other information service activities n.e.c." },
          { code: "6110", description: "Wired telecommunications" },
          { code: "6120", description: "Wireless telecommunications" },
          { code: "6190", description: "Other telecommunications" },
          { code: "5820", description: "Software publishing" },
        ],
      },
    });
    console.log("Company record created.");
  } else {
    console.log("Company record already exists — skipped.");
  }

  // --- Roles & permissions (Section 6) ------------------------------------
  const roleIdByName = new Map<string, string>();
  for (const [name, def] of Object.entries(ROLE_DEFINITIONS)) {
    const role = await prisma.role.upsert({
      where: { name },
      update: { label: def.label, description: def.description },
      create: {
        name,
        label: def.label,
        description: def.description,
        isSystem: true,
      },
    });
    roleIdByName.set(name, role.id);

    for (const grant of def.permissions) {
      await prisma.permission.upsert({
        where: {
          roleId_module_verb: {
            roleId: role.id,
            module: grant.module,
            verb: grant.verb,
          },
        },
        update: {},
        create: { roleId: role.id, module: grant.module, verb: grant.verb },
      });
    }
  }
  console.log(`Seeded ${roleIdByName.size} roles.`);

  // --- People (Section 3.1 cap table + Section 4 user mapping) -----------
  const ALLOCATION_SOURCE = "BRELA consolidated registration, 25 Feb 2026";
  const ALLOCATION_DATE = new Date("2026-02-25");

  type PersonSeed = {
    email: string;
    fullName: string;
    isDirector: boolean;
    isCompanySecretary?: boolean;
    isPrimaryBankSignatory?: boolean;
    isShareholder: boolean;
    shares?: number;
    percent?: number;
    isEmployee?: boolean;
    roles: string[];
  };

  const people: PersonSeed[] = [
    {
      email: "akisute@solomontechsolutions.com",
      fullName: "Allan Silas Kisute",
      isDirector: true,
      isPrimaryBankSignatory: true,
      isShareholder: true,
      shares: 650,
      percent: 65,
      roles: ["director", "finance"],
    },
    {
      email: "cjohn@solomontechsolutions.com",
      fullName: "Christopher John Kwetu",
      isDirector: true,
      isShareholder: true,
      shares: 50,
      percent: 5,
      roles: ["director"],
    },
    {
      email: "emmasyeba@solomontechsolutions.com",
      fullName: "Emmanuel Charles Masyeba",
      isDirector: true,
      isShareholder: true,
      shares: 50,
      percent: 5,
      roles: ["director"],
    },
    {
      email: "gchallo@solomontechsolutions.com",
      fullName: "George Pius Challo",
      isDirector: true,
      isShareholder: true,
      shares: 50,
      percent: 5,
      roles: ["director"],
    },
    {
      email: "hykatunka@solomontechsolutions.com",
      fullName: "Henry Malaso Katunka",
      isDirector: true,
      isShareholder: true,
      shares: 50,
      percent: 5,
      roles: ["director"],
    },
    {
      email: "martin@solomontechsolutions.com",
      fullName: "Martin Hemed Kisute",
      isDirector: true,
      isShareholder: true,
      shares: 50,
      percent: 5,
      roles: ["director"],
    },
    {
      email: "msilas@solomontechsolutions.com",
      fullName: "Mathias Silas Kisute",
      isDirector: true,
      isCompanySecretary: true,
      isShareholder: true,
      shares: 50,
      percent: 5,
      roles: ["director", "company_secretary", "finance"],
    },
    {
      // Gap #4 (not yet confirmed by the user): default to Management/Admin
      // per the brief's own fallback. He is a 5% shareholder but not a
      // current BRELA director, so he does NOT get the "director" role.
      email: "mj@solomontechsolutions.com",
      fullName: "Mjanaheri Yusuph Mjanaheri",
      isDirector: false,
      isShareholder: true,
      shares: 50,
      percent: 5,
      roles: ["management_admin"],
    },
    {
      email: "novatus@solomontechsolutions.com",
      fullName: "Novatus Masalu Nyanda",
      isDirector: false,
      isShareholder: false,
      isEmployee: true,
      roles: ["employee"],
    },
  ];

  const credentialsToPrint: { email: string; password: string }[] = [];

  for (const person of people) {
    const existingUser = await prisma.user.findUnique({
      where: { email: person.email },
    });
    if (existingUser) {
      console.log(`User ${person.email} already exists — skipped.`);
      continue;
    }

    const tempPassword = generateTempPassword();
    const passwordHash = await bcrypt.hash(tempPassword, 12);

    const user = await prisma.user.create({
      data: {
        email: person.email,
        name: person.fullName,
        passwordHash,
        mustResetPassword: true,
      },
    });
    credentialsToPrint.push({ email: person.email, password: tempPassword });

    if (person.isDirector) {
      await prisma.director.create({
        data: {
          userId: user.id,
          fullName: person.fullName,
          isCompanySecretary: person.isCompanySecretary ?? false,
          isPrimaryBankSignatory: person.isPrimaryBankSignatory ?? false,
          appointedDate: ALLOCATION_DATE,
        },
      });
    }

    if (person.isShareholder) {
      const shareholder = await prisma.shareholder.create({
        data: { userId: user.id, fullName: person.fullName },
      });
      await prisma.shareAllocation.create({
        data: {
          shareholderId: shareholder.id,
          shares: person.shares!,
          percent: person.percent!,
          effectiveDate: ALLOCATION_DATE,
          source: ALLOCATION_SOURCE,
        },
      });
    }

    if (person.isEmployee) {
      await prisma.employee.create({
        data: {
          userId: user.id,
          employeeNumber: "STS-EMP-0001",
          fullName: person.fullName,
          jobTitle: "Network Operator",
          department: "Operations / Technical Services",
          site: "Mwanza (SAUT)",
          employmentStatus: "active",
          grossSalary: 650_000,
          leaveEntitlementDays: 28,
        },
      });
    }

    for (const roleName of person.roles) {
      const roleId = roleIdByName.get(roleName);
      if (!roleId) throw new Error(`Unknown role: ${roleName}`);
      await prisma.userRole.create({
        data: { userId: user.id, roleId },
      });
    }

    console.log(`Seeded user ${person.email} (${person.roles.join(", ")}).`);
  }

  if (credentialsToPrint.length > 0) {
    console.log("\n=== TEMPORARY PASSWORDS (shown once — not stored anywhere) ===");
    for (const c of credentialsToPrint) {
      console.log(`${c.email}  ${c.password}`);
    }
    console.log("=== Deliver these out-of-band and ask each user to sign in and reset. ===\n");
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
