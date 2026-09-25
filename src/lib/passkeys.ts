import { headers } from "next/headers";
import {
  generateAuthenticationOptions,
  generateRegistrationOptions,
  verifyAuthenticationResponse,
  verifyRegistrationResponse,
} from "@simplewebauthn/server";
import type {
  AuthenticationResponseJSON,
  AuthenticatorTransportFuture,
  RegistrationResponseJSON,
} from "@simplewebauthn/types";
import { prisma } from "@/lib/prisma";
import { canonicalHost } from "@/lib/site";

/**
 * Passkeys: sign-in and confirmation with the phone's or computer's own
 * security (Face ID, Touch ID, Android fingerprint or face unlock, Windows
 * Hello, or the device PIN). Every ceremony requires user verification, so
 * a passkey always means "the owner unlocked this device just now", never
 * mere possession of it.
 */

const CHALLENGE_TTL_MS = 5 * 60 * 1000;
export type PasskeyPurpose = "register" | "login" | "verify";

/**
 * Relying party: the domain passkeys belong to. WEBAUTHN_RP_ID may widen it
 * to the parent domain (solomontechsolutions.com) so any company subdomain
 * accepts the same passkey; otherwise it is the canonical host, falling
 * back to the host of the current request in development.
 */
async function relyingParty() {
  const h = await headers();
  const requestHost = (h.get("x-forwarded-host") ?? h.get("host") ?? "localhost").split(",")[0].trim();
  const proto = (h.get("x-forwarded-proto") ?? (requestHost.startsWith("localhost") ? "http" : "https")).split(",")[0].trim();
  const host = canonicalHost() ?? requestHost;
  const rpID = process.env.WEBAUTHN_RP_ID?.trim() || host.split(":")[0];
  return { rpID, rpName: "KASI", origin: `${proto}://${host}` };
}

function b64url(bytes: Uint8Array): string {
  return Buffer.from(bytes).toString("base64url");
}

async function storeChallenge(challenge: string, purpose: PasskeyPurpose, userId: string | null) {
  // Housekeeping: drop expired challenges so the table never grows.
  await prisma.webAuthnChallenge.deleteMany({ where: { expiresAt: { lt: new Date() } } });
  const row = await prisma.webAuthnChallenge.create({
    data: { challenge, purpose, userId, expiresAt: new Date(Date.now() + CHALLENGE_TTL_MS) },
  });
  return row.id;
}

/** Takes a challenge exactly once; a replayed or stale one returns null. */
async function consumeChallenge(id: string, purpose: PasskeyPurpose, userId: string | null) {
  const row = await prisma.webAuthnChallenge.findUnique({ where: { id } });
  if (!row) return null;
  await prisma.webAuthnChallenge.delete({ where: { id } }).catch(() => undefined);
  if (row.purpose !== purpose || row.expiresAt < new Date()) return null;
  if (userId !== null && row.userId !== userId) return null;
  return row.challenge;
}

export async function registrationOptions(user: { id: string; email: string; name: string }) {
  const rp = await relyingParty();
  const existing = await prisma.passkey.findMany({ where: { userId: user.id } });
  const options = await generateRegistrationOptions({
    rpName: rp.rpName,
    rpID: rp.rpID,
    userID: user.id,
    userName: user.email,
    userDisplayName: user.name,
    attestationType: "none",
    excludeCredentials: existing.map((p) => ({
      id: Buffer.from(p.credentialId, "base64url"),
      type: "public-key" as const,
      transports: p.transports as AuthenticatorTransportFuture[],
    })),
    authenticatorSelection: { residentKey: "required", userVerification: "required" },
  });
  const challengeId = await storeChallenge(options.challenge, "register", user.id);
  return { challengeId, options };
}

export async function finishRegistration(
  userId: string,
  challengeId: string,
  response: RegistrationResponseJSON,
  name: string,
) {
  const challenge = await consumeChallenge(challengeId, "register", userId);
  if (!challenge) throw new Error("This request expired. Try again.");
  const rp = await relyingParty();
  const result = await verifyRegistrationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpID,
    requireUserVerification: true,
  });
  if (!result.verified || !result.registrationInfo) throw new Error("The device could not be verified.");
  const info = result.registrationInfo;
  return prisma.passkey.create({
    data: {
      userId,
      credentialId: b64url(info.credentialID),
      publicKey: Buffer.from(info.credentialPublicKey),
      counter: info.counter,
      transports: response.response.transports ?? [],
      deviceType: info.credentialDeviceType,
      backedUp: info.credentialBackedUp,
      name: name.trim().slice(0, 60) || "This device",
    },
  });
}

/**
 * Options for proving identity with a passkey. For sign-in no account is
 * named, so the phone offers the passkeys it holds for KASI; for "verify"
 * (unlocking the app, confirming a signature) only the signed-in person's
 * own passkeys are accepted.
 */
export async function authenticationOptions(purpose: "login" | "verify", userId: string | null) {
  const rp = await relyingParty();
  const mine = userId ? await prisma.passkey.findMany({ where: { userId } }) : [];
  if (purpose === "verify" && mine.length === 0) {
    throw new Error("No passkey is set up for your account yet. Add one under Security & device.");
  }
  const options = await generateAuthenticationOptions({
    rpID: rp.rpID,
    userVerification: "required",
    allowCredentials: mine.map((p) => ({
      id: Buffer.from(p.credentialId, "base64url"),
      type: "public-key" as const,
      transports: p.transports as AuthenticatorTransportFuture[],
    })),
  });
  const challengeId = await storeChallenge(options.challenge, purpose, userId);
  return { challengeId, options };
}

/**
 * Verifies a passkey assertion and returns the user it proves. For
 * "verify", `userId` must match the passkey's owner.
 */
export async function finishAuthentication(
  purpose: "login" | "verify",
  challengeId: string,
  response: AuthenticationResponseJSON,
  userId: string | null,
): Promise<string> {
  const challenge = await consumeChallenge(challengeId, purpose, userId);
  if (!challenge) throw new Error("This request expired. Try again.");
  const passkey = await prisma.passkey.findUnique({ where: { credentialId: response.id } });
  if (!passkey) throw new Error("This passkey is not registered with KASI.");
  if (userId !== null && passkey.userId !== userId) throw new Error("This passkey belongs to another account.");

  const rp = await relyingParty();
  const result = await verifyAuthenticationResponse({
    response,
    expectedChallenge: challenge,
    expectedOrigin: rp.origin,
    expectedRPID: rp.rpID,
    requireUserVerification: true,
    authenticator: {
      credentialID: Buffer.from(passkey.credentialId, "base64url"),
      credentialPublicKey: new Uint8Array(passkey.publicKey),
      counter: passkey.counter,
      transports: passkey.transports as AuthenticatorTransportFuture[],
    },
  });
  if (!result.verified) throw new Error("The device could not be verified.");

  await prisma.passkey.update({
    where: { id: passkey.id },
    data: { counter: result.authenticationInfo.newCounter, lastUsedAt: new Date() },
  });
  return passkey.userId;
}
