import { createHash } from "node:crypto";
import { prisma } from "@/lib/prisma";
import { AGREEMENT_SEEDS } from "@/lib/boardroom/agreement-templates";
import { listBoardMembers } from "@/lib/boardroom/members";

export function hashAgreementBody(body: string): string {
  return createHash("sha256").update(body, "utf8").digest("hex");
}

/**
 * Creates version 1 of any agreement that has never been published. Runs on
 * page load rather than in the seed so deployments that were seeded before
 * the Boardroom existed get the agreements without re-running setup.
 * Existing versions are never touched.
 */
export async function ensureAgreementTemplates() {
  const existing = await prisma.agreementTemplate.findMany({
    select: { code: true },
    distinct: ["code"],
  });
  const have = new Set(existing.map((t) => t.code));
  const missing = AGREEMENT_SEEDS.filter((s) => !have.has(s.code));
  if (missing.length === 0) return;

  const company = await prisma.company.findFirst({ select: { legalName: true } });
  const companyName = company?.legalName ?? "Solomon Tech Solutions Limited";

  for (const seed of missing) {
    const body = seed.body.replaceAll("{{company}}", companyName);
    // Two first page loads can race here; the unique (code, version) key
    // makes the loser fail harmlessly, so that error is swallowed.
    await prisma.agreementTemplate.upsert({
      where: { code_version: { code: seed.code, version: 1 } },
      update: {},
      create: {
        code: seed.code,
        version: 1,
        title: seed.title,
        summary: seed.summary,
        body,
        contentHash: hashAgreementBody(body),
        isCurrent: true,
      },
    }).catch((error: { code?: string }) => {
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
