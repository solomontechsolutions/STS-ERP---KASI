import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AGREEMENT_SEEDS } from "@/lib/boardroom/agreement-templates";
import { listBoardMembers } from "@/lib/boardroom/members";

export function hashAgreementBody(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

/** House style for agreement text: no em-dashes, no runs of spaces. */
export function agreementStyleProblems(text: string): string[] {
  const problems: string[] = [];
  if (/[\u2014\u2015]/.test(text)) problems.push("Replace em-dashes with a comma, a colon or the word \"to\".");
  if (/[^\S\n]{2,}/.test(text)) problems.push("Remove double spaces.");
  return problems;
}

function fillPlaceholders(
  text: string,
  company: { legalName: string; brelaNumber: string; registeredOfficeAddress: string } | null,
) {
  return text
    .replaceAll("{{company}}", (company?.legalName ?? "Solomon Tech Solutions Limited").toUpperCase())
    .replaceAll("{{companyNumber}}", company?.brelaNumber ?? "")
    .replaceAll("{{registeredOffice}}", company?.registeredOfficeAddress ?? "");
}

/**
 * Keeps the agreements in step with the standard wording in
 * agreement-templates.ts. Runs on page load (not in the seed) so existing
 * deployments pick it up without re-running setup.
 *
 * - An agreement never published is created as version 1.
 * - A current version that KASI itself created (no publisher) and whose text
 *   differs from today's standard wording is superseded by a new version.
 * - A version published by a director or the Company Secretary is never
 *   touched: their wording always wins.
 */
export async function ensureAgreementTemplates() {
  const [current, company] = await Promise.all([
    prisma.agreementTemplate.findMany({
      where: { isCurrent: true },
      select: { id: true, code: true, version: true, contentHash: true, publishedById: true, title: true },
    }),
    prisma.company.findFirst({
      select: { legalName: true, brelaNumber: true, registeredOfficeAddress: true },
    }),
  ]);

  for (const seed of AGREEMENT_SEEDS) {
    const body = fillPlaceholders(seed.body, company);
    const hash = hashAgreementBody(body);
    const existing = current.find((t) => t.code === seed.code);
    if (existing && (existing.publishedById || (existing.contentHash === hash && existing.title === seed.title))) {
      continue;
    }

    const version = existing ? existing.version + 1 : 1;
    // Two first page loads can race here; the unique (code, version) key
    // makes the loser fail harmlessly, so that error is swallowed.
    await prisma
      .$transaction([
        prisma.agreementTemplate.updateMany({
          where: { code: seed.code, isCurrent: true, publishedById: null },
          data: { isCurrent: false },
        }),
        prisma.agreementTemplate.create({
          data: {
            code: seed.code,
            version,
            title: seed.title,
            summary: seed.summary,
            body,
            contentHash: hash,
            isCurrent: true,
          },
        }),
      ])
      .catch((error: { code?: string }) => {
        if (error.code !== "P2002") throw error;
      });
  }
}

export async function listCurrentAgreements() {
  await ensureAgreementTemplates();
  const order = AGREEMENT_SEEDS.map((s) => s.code);
  const templates = await prisma.agreementTemplate.findMany({
    where: { isCurrent: true },
    include: { signatures: { select: { userId: true, signedAt: true, id: true } } },
  });
  return templates.sort((a, b) => {
    const ia = order.indexOf(a.code);
    const ib = order.indexOf(b.code);
    return (ia === -1 ? 99 : ia) - (ib === -1 ? 99 : ib);
  });
}

/** Signature matrix: every board member against every current agreement. */
export async function getSignatureMatrix() {
  const [agreements, members] = await Promise.all([
    listCurrentAgreements(),
    listBoardMembers(),
  ]);
  const rows = members.map((m) => ({
    member: m,
    cells: agreements.map((a) => {
      const sig = a.signatures.find((s) => s.userId === m.userId);
      return { agreementId: a.id, signatureId: sig?.id ?? null, signedAt: sig?.signedAt ?? null };
    }),
  }));
  const totalRequired = agreements.length * members.length;
  const totalSigned = rows.reduce(
    (n, r) => n + r.cells.filter((c) => c.signedAt).length,
    0,
  );
  return { agreements, rows, totalRequired, totalSigned };
}

export async function pendingAgreementsFor(userId: string) {
  const agreements = await listCurrentAgreements();
  return agreements.filter((a) => !a.signatures.some((s) => s.userId === userId));
}
