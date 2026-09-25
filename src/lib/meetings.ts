import { createHmac, createSign, randomBytes } from "node:crypto";
import { prisma } from "@/lib/prisma";

/**
 * Online meetings run on Jitsi Meet, embedded in KASI through Jitsi's
 * IFrame API, so directors meet inside the PWA on phone or desktop without
 * installing anything. Three hosting options, chosen by environment:
 *
 * - "jaas" (recommended): 8x8 Jitsi as a Service. Set JAAS_APP_ID,
 *   JAAS_API_KEY_ID and JAAS_PRIVATE_KEY. KASI signs a short-lived RS256
 *   token per participant, so only people KASI lets in can join a room.
 * - "jitsi" with JITSI_APP_ID/JITSI_APP_SECRET: a self-hosted Jitsi server
 *   configured for token auth. Same idea, HS256 tokens. Best for secrecy:
 *   no audio or video passes through a third party.
 * - "jitsi" with neither: a public or self-hosted server without auth. Rooms
 *   are protected only by their unguessable names. Fine for trying it out,
 *   not for confidential board business.
 */
export type MeetingProvider = {
  kind: "jaas" | "jitsi";
  domain: string;
  scriptUrl: string;
  /** Room path passed to the IFrame API. */
  roomFor: (roomName: string) => string;
  secured: boolean;
};

export function getMeetingProvider(): MeetingProvider {
  const jaasAppId = process.env.JAAS_APP_ID;
  if (jaasAppId && process.env.JAAS_API_KEY_ID && process.env.JAAS_PRIVATE_KEY) {
    return {
      kind: "jaas",
      domain: "8x8.vc",
      scriptUrl: `https://8x8.vc/${jaasAppId}/external_api.js`,
      roomFor: (room) => `${jaasAppId}/${room}`,
      secured: true,
    };
  }
  const domain = (process.env.JITSI_DOMAIN || "meet.jit.si").replace(/^https?:\/\//, "").replace(/\/+$/, "");
  return {
    kind: "jitsi",
    domain,
    scriptUrl: `https://${domain}/external_api.js`,
    roomFor: (room) => room,
    secured: Boolean(process.env.JITSI_APP_ID && process.env.JITSI_APP_SECRET),
  };
}

function b64url(input: Buffer | string): string {
  return Buffer.from(input).toString("base64url");
}

type Participant = { id: string; name: string; email: string; moderator: boolean };

/**
 * Signs a meeting token for one participant, or returns null when the
 * provider runs without auth. Tokens live for the meeting's length plus an
 * hour, so a leaked token is useless the next day.
 */
export function signMeetingToken(
  provider: MeetingProvider,
  roomName: string,
  user: Participant,
  validForSeconds: number,
): string | null {
  const now = Math.floor(Date.now() / 1000);
  const userContext = {
    id: user.id,
    name: user.name,
    email: user.email,
    moderator: user.moderator ? "true" : "false",
  };

  if (provider.kind === "jaas") {
    const header = { alg: "RS256", typ: "JWT", kid: process.env.JAAS_API_KEY_ID };
    const payload = {
      aud: "jitsi",
      iss: "chat",
      sub: process.env.JAAS_APP_ID,
      room: roomName,
      iat: now,
      nbf: now - 10,
      exp: now + validForSeconds,
      context: {
        user: userContext,
        features: {
          // Secrecy: nobody records or streams board meetings from KASI.
          recording: "false",
          livestreaming: "false",
          transcription: "false",
          "outbound-call": "false",
        },
      },
    };
    const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
    const key = (process.env.JAAS_PRIVATE_KEY ?? "").replace(/\\n/g, "\n");
    const signature = createSign("RSA-SHA256").update(unsigned).sign(key);
    return `${unsigned}.${b64url(signature)}`;
  }

  const appId = process.env.JITSI_APP_ID;
  const secret = process.env.JITSI_APP_SECRET;
  if (!appId || !secret) return null;
  const header = { alg: "HS256", typ: "JWT" };
  const payload = {
    aud: appId,
    iss: appId,
    sub: provider.domain,
    room: roomName,
    iat: now,
    nbf: now - 10,
    exp: now + validForSeconds,
    context: { user: userContext },
  };
  const unsigned = `${b64url(JSON.stringify(header))}.${b64url(JSON.stringify(payload))}`;
  const signature = createHmac("sha256", secret).update(unsigned).digest();
  return `${unsigned}.${b64url(signature)}`;
}

/** 20 random characters: not guessable, still valid in a Jitsi room name. */
export function newRoomName(): string {
  return `sts${randomBytes(15).toString("hex")}`.slice(0, 23);
}

export const MEETING_KIND_LABELS: Record<string, string> = {
  board: "Board meeting",
  shareholders: "Shareholders' meeting",
  management: "Management meeting",
  general: "General meeting",
};

/** Board and shareholder meetings are only for the founders. */
export function isBoardMeetingKind(kind: string) {
  return kind === "board" || kind === "shareholders";
}

export async function canAccessMeeting(userId: string, meetingId: string) {
  const meeting = await prisma.meeting.findUnique({
    where: { id: meetingId },
    select: { createdById: true, invitees: { where: { userId }, select: { id: true } } },
  });
  if (!meeting) return false;
  return meeting.createdById === userId || meeting.invitees.length > 0;
}

/** The window during which the Join button is live. */
export function meetingWindow(m: { scheduledAt: Date; durationMinutes: number }) {
  const opensAt = new Date(m.scheduledAt.getTime() - 15 * 60 * 1000);
  const endsAt = new Date(m.scheduledAt.getTime() + (m.durationMinutes + 60) * 60 * 1000);
  return { opensAt, endsAt };
}
