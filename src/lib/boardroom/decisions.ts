import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { notifyUsers } from "@/lib/notifications";
import { listBoardMembers, type BoardMember } from "@/lib/boardroom/members";

export type VotingBasis = "per_director" | "shareholding";
export type Threshold = "simple_majority" | "special_75" | "unanimous";
export type VoteChoice = "for" | "against" | "abstain";
export type ElectorateEntry = { userId: string; name: string; weight: number };

export const CATEGORY_LABELS: Record<string, string> = {
  board_resolution: "Board resolution",
  shareholder_resolution: "Shareholder resolution",
};

export const BASIS_LABELS: Record<VotingBasis, string> = {
  per_director: "One vote per director",
  shareholding: "Weighted by shareholding",
};

export const THRESHOLD_LABELS: Record<Threshold, string> = {
  simple_majority: "Simple majority (more than 50%)",
  special_75: "Special resolution (at least 75%)",
  unanimous: "Unanimous (100%)",
};

/**
 * Who votes and with what weight. Board resolutions give each director one
 * vote. Shareholder resolutions weight each shareholder by their percentage
 * of the issued shares, so the 65% holder carries 65 of 100.
 */
export function buildElectorate(
  members: BoardMember[],
  basis: VotingBasis,
): ElectorateEntry[] {
  if (basis === "per_director") {
    return members
      .filter((m) => m.isDirector)
      .map((m) => ({ userId: m.userId, name: m.name, weight: 1 }));
  }
  return members
    .filter((m) => m.isShareholder && m.sharePercent > 0)
    .map((m) => ({ userId: m.userId, name: m.name, weight: m.sharePercent }));
}

export async function electorateFor(basis: VotingBasis) {
  return buildElectorate(await listBoardMembers(), basis);
}

function requiredShare(threshold: string): { share: number; strict: boolean } {
  if (threshold === "unanimous") return { share: 1, strict: false };
  if (threshold === "special_75") return { share: 0.75, strict: false };
  return { share: 0.5, strict: true };
}

function meets(value: number, total: number, threshold: string) {
  const { share, strict } = requiredShare(threshold);
  const needed = total * share;
  // Small epsilon: percentages are stored as decimals.
  return strict ? value > needed + 1e-9 : value >= needed - 1e-9;
}

/**
 * Tally against the WHOLE electorate, not just those who voted. That is the
 * rule for written resolutions (a resolution passes only once members
 * holding the required share of all voting rights agree), and it is the
 * conservative choice: an absent member can never be counted as agreeing.
 * Abstentions therefore work like votes against.
 */
export function tally(
  electorate: ElectorateEntry[],
  votes: { userId: string; choice: string; weight: unknown }[],
  threshold: string,
) {
  const total = electorate.reduce((n, e) => n + e.weight, 0);
  const sum = (choice: string) =>
    votes.filter((v) => v.choice === choice).reduce((n, v) => n + Number(v.weight), 0);
  const forWeight = sum("for");
  const againstWeight = sum("against");
  const abstainWeight = sum("abstain");
  const outstanding = Math.max(0, total - forWeight - againstWeight - abstainWeight);

  const passed = meets(forWeight, total, threshold);
  // Even if every outstanding vote came in "for", could it still pass?
  const canStillPass = meets(forWeight + outstanding, total, threshold);
  const { share } = requiredShare(threshold);

  return {
    total,
    forWeight,
    againstWeight,
    abstainWeight,
    outstanding,
    requiredWeight: total * share,
    passed,
    decided: passed || !canStillPass,
  };
}

export function parseElectorate(value: unknown): ElectorateEntry[] {
  if (!Array.isArray(value)) return [];
  return value.map((e) => ({
    userId: String((e as ElectorateEntry).userId),
    name: String((e as ElectorateEntry).name),
    weight: Number((e as ElectorateEntry).weight),
  }));
}

export async function nextDecisionReference(): Promise<string> {
  const year = new Date().getFullYear();
  const prefix = `DEC-${year}-`;
  const last = await prisma.decision.findFirst({
    where: { reference: { startsWith: prefix } },
    orderBy: { reference: "desc" },
    select: { reference: true },
  });
  const n = last ? Number(last.reference.slice(prefix.length)) + 1 : 1;
  return `${prefix}${String(n).padStart(3, "0")}`;
}

/**
 * Closes a decision once its outcome is certain or its deadline has passed,
 * and tells every board member the result. Safe to call repeatedly: the
 * status guard in the update makes only the first caller close it.
 */
export async function settleDecision(decisionId: string, actorId?: string) {
  const decision = await prisma.decision.findUnique({
    where: { id: decisionId },
    include: { votes: true },
  });
  if (!decision || decision.status !== "open") return null;

  const result = tally(parseElectorate(decision.electorate), decision.votes, decision.threshold);
  const expired = decision.closesAt.getTime() <= Date.now();
  if (!result.decided && !expired) return null;

  const status = result.passed ? "passed" : "rejected";
  const outcomeNote = result.passed
    ? `Passed with ${fmtWeight(result.forWeight, decision.votingBasis)} in favour of ${fmtWeight(result.total, decision.votingBasis)}.`
    : expired && !result.decided
      ? `Not passed: voting closed with ${fmtWeight(result.forWeight, decision.votingBasis)} in favour, short of the ${fmtWeight(result.requiredWeight, decision.votingBasis)} required.`
      : `Rejected: the required ${fmtWeight(result.requiredWeight, decision.votingBasis)} in favour can no longer be reached.`;

  const updated = await prisma.decision.updateMany({
    where: { id: decisionId, status: "open" },
    data: { status, closedAt: new Date(), outcomeNote },
  });
  if (updated.count === 0) return null;

  await recordAudit({
    entityType: "decision",
    entityId: decisionId,
    action: status === "passed" ? "pass" : "reject",
    actorId: actorId ?? null,
    afterData: { status, outcomeNote, tally: result },
  });

  const members = await listBoardMembers();
  await notifyUsers(
    members.map((m) => m.userId),
    {
      category: "decision",
      title: `${decision.reference} ${status === "passed" ? "passed" : "not passed"}`,
      body: `${decision.title}. ${outcomeNote}`,
      url: `/boardroom/decisions/${decision.id}`,
    },
  );
  return status;
}

/** Closes every open decision whose deadline has passed. Used by the cron tick. */
export async function settleExpiredDecisions() {
  const due = await prisma.decision.findMany({
    where: { status: "open", closesAt: { lte: new Date() } },
    select: { id: true },
  });
  for (const d of due) await settleDecision(d.id);
  return due.length;
}

export function fmtWeight(weight: number, basis: string): string {
  if (basis === "shareholding") {
    return `${Number(weight.toFixed(2))}% of shares`;
  }
  const n = Number(weight.toFixed(2));
  return `${n} ${n === 1 ? "vote" : "votes"}`;
}
