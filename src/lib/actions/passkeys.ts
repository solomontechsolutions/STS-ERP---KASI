"use server";

import bcrypt from "bcryptjs";
import { revalidatePath } from "next/cache";
import { AuthError } from "next-auth";
import type { AuthenticationResponseJSON, RegistrationResponseJSON } from "@simplewebauthn/types";
import { auth, signIn } from "@/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";
import { getRequestMeta } from "@/lib/request-meta";
import {
  authenticationOptions,
  finishAuthentication,
  finishRegistration,
  registrationOptions,
} from "@/lib/passkeys";

type Result = { ok?: boolean; error?: string };

async function requireUser() {
  const session = await auth();
  if (!session?.user) throw new Error("Your session has expired. Sign in again.");
  return session.user;
}

function message(error: unknown) {
  return error instanceof Error ? error.message : "Something went wrong. Try again.";
}

// --- Setting up a passkey on this device -----------------------------------

export async function passkeyRegistrationOptionsAction() {
  const user = await requireUser();
  const row = await prisma.user.findUniqueOrThrow({ where: { id: user.id } });
  return registrationOptions({ id: row.id, email: row.email, name: row.name });
}

export async function registerPasskeyAction(
  challengeId: string,
  response: RegistrationResponseJSON,
  deviceName: string,
): Promise<Result> {
  try {
    const user = await requireUser();
    const passkey = await finishRegistration(user.id, challengeId, response, deviceName);
    await recordAudit({
      entityType: "passkey",
      entityId: passkey.id,
      action: "create",
      actorId: user.id,
      afterData: { name: passkey.name, deviceType: passkey.deviceType },
      ...(await getRequestMeta()),
    });
    revalidatePath("/settings/security");
    return { ok: true };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function removePasskeyAction(id: string) {
  const user = await requireUser();
  const removed = await prisma.passkey.deleteMany({ where: { id, userId: user.id } });
  if (removed.count > 0) {
    await recordAudit({ entityType: "passkey", entityId: id, action: "delete", actorId: user.id });
  }
  revalidatePath("/settings/security");
}

export async function renamePasskeyAction(id: string, formData: FormData) {
  const user = await requireUser();
  const name = String(formData.get("name") ?? "").trim().slice(0, 60);
  if (!name) return;
  await prisma.passkey.updateMany({ where: { id, userId: user.id }, data: { name } });
  revalidatePath("/settings/security");
}

// --- Signing in with Face ID / fingerprint ----------------------------------

export async function passkeyLoginOptionsAction() {
  return authenticationOptions("login", null);
}

export async function passkeySignInAction(
  challengeId: string,
  response: AuthenticationResponseJSON,
  callbackUrl: string,
): Promise<Result> {
  // Only same-site paths: never bounce a fresh session to another site.
  const redirectTo = callbackUrl.startsWith("/") && !callbackUrl.startsWith("//") ? callbackUrl : "/";
  try {
    await signIn("passkey", { challengeId, response: JSON.stringify(response), redirectTo });
    return { ok: true };
  } catch (error) {
    if (error instanceof AuthError) {
      return { error: "That passkey was not accepted. Use your password, or set up Face ID again after signing in." };
    }
    throw error; // the redirect after a successful sign-in
  }
}

// --- Confirming it is you (app lock, signing documents) ---------------------

export async function passkeyVerifyOptionsAction() {
  const user = await requireUser();
  try {
    return { ...(await authenticationOptions("verify", user.id)) };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function unlockWithPasskeyAction(
  challengeId: string,
  response: AuthenticationResponseJSON,
): Promise<Result> {
  try {
    const user = await requireUser();
    await finishAuthentication("verify", challengeId, response, user.id);
    return { ok: true };
  } catch (error) {
    return { error: message(error) };
  }
}

export async function unlockWithPasswordAction(password: string): Promise<Result> {
  const user = await requireUser();
  const row = await prisma.user.findUnique({ where: { id: user.id } });
  if (!row || !(await bcrypt.compare(password, row.passwordHash))) {
    return { error: "Password is incorrect." };
  }
  return { ok: true };
}
