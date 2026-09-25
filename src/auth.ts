import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { prisma } from "@/lib/prisma";
import { authConfig } from "@/auth.config";
import { finishAuthentication } from "@/lib/passkeys";
import { recordAudit } from "@/lib/audit";

export const { handlers, signIn, signOut, auth } = NextAuth({
  ...authConfig,
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (credentials) => {
        const email = credentials?.email;
        const password = credentials?.password;
        if (typeof email !== "string" || typeof password !== "string") {
          return null;
        }

        const user = await prisma.user.findUnique({
          where: { email: email.toLowerCase() },
        });
        if (!user || !user.isActive) return null;

        const valid = await bcrypt.compare(password, user.passwordHash);
        if (!valid) return null;

        await prisma.user.update({
          where: { id: user.id },
          data: { lastLoginAt: new Date() },
        });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          mustResetPassword: user.mustResetPassword,
        };
      },
    }),
    // Face ID, fingerprint, Windows Hello or device PIN, via a passkey the
    // person set up under Security & device. The browser half runs in
    // PasskeySignInButton; this verifies the device's signed answer.
    Credentials({
      id: "passkey",
      name: "Passkey",
      credentials: { challengeId: {}, response: {} },
      authorize: async (credentials) => {
        const challengeId = credentials?.challengeId;
        const response = credentials?.response;
        if (typeof challengeId !== "string" || typeof response !== "string") return null;

        let userId: string;
        try {
          userId = await finishAuthentication("login", challengeId, JSON.parse(response), null);
        } catch {
          return null;
        }

        const user = await prisma.user.findUnique({ where: { id: userId } });
        if (!user || !user.isActive) return null;

        await prisma.user.update({ where: { id: user.id }, data: { lastLoginAt: new Date() } });
        await recordAudit({ entityType: "user", entityId: user.id, action: "login_passkey", actorId: user.id });

        return {
          id: user.id,
          email: user.email,
          name: user.name,
          mustResetPassword: user.mustResetPassword,
        };
      },
    }),
  ],
});
