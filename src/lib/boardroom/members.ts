import { prisma } from "@/lib/prisma";

/**
 * Board membership is an identity fact, not an RBAC grant: anyone holding a
 * Director or Shareholder record is one of the founders and belongs in the
 * Boardroom (agreements, decisions, board meetings). Deriving it from the
 * identity records means nobody has to remember to grant a role when the cap
 * table or the board changes.
 */
export type BoardMember = {
  userId: string;
  name: string;
  email: string;
  isDirector: boolean;
  isCompanySecretary: boolean;
  isShareholder: boolean;
  /** Current shareholding in percent (latest allocation), 0 if none. */
  sharePercent: number;
};

function latestPercent(
  allocations: { percent: unknown; effectiveDate: Date }[],
): number {
  if (allocations.length === 0) return 0;
  const latest = [...allocations].sort(
    (a, b) => b.effectiveDate.getTime() - a.effectiveDate.getTime(),
  )[0];
  return Number(latest.percent);
}

export async function listBoardMembers(): Promise<BoardMember[]> {
  const users = await prisma.user.findMany({
    where: {
      isActive: true,
      OR: [{ director: { isNot: null } }, { shareholder: { isNot: null } }],
    },
    include: {
      director: true,
      shareholder: { include: { allocations: true } },
    },
    orderBy: { name: "asc" },
  });

  return users.map((u) => ({
    userId: u.id,
    name: u.name,
    email: u.email,
    isDirector: Boolean(u.director),
    isCompanySecretary: Boolean(u.director?.isCompanySecretary),
    isShareholder: Boolean(u.shareholder),
    sharePercent: u.shareholder ? latestPercent(u.shareholder.allocations) : 0,
  }));
}

export async function getBoardMember(userId: string): Promise<BoardMember | null> {
  const members = await listBoardMembers();
  return members.find((m) => m.userId === userId) ?? null;
}

export async function isBoardMember(userId: string): Promise<boolean> {
  const count = await prisma.user.count({
    where: {
      id: userId,
      isActive: true,
      OR: [{ director: { isNot: null } }, { shareholder: { isNot: null } }],
    },
  });
  return count > 0;
}

/**
 * Who can publish agreement wording and open decisions for a vote: the
 * Company Secretary, plus any director (the board acts collectively).
 */
export function canAdministerBoardroom(member: BoardMember | null): boolean {
  return Boolean(member && (member.isDirector || member.isCompanySecretary));
}
