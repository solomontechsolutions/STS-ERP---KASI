import { createHash } from "node:crypto";
import type { NextAuthConfig } from "next-auth";

/**
 * The key that signs session cookies. It must never be committed — anyone
 * holding it can forge a login — so it can only come from the environment.
 *
 * `AUTH_SECRET` is the variable to set. When it is absent but a Supabase
 * secret is present (the Vercel integration injects these), derive a
 * distinct key from it so a freshly linked project boots instead of
 * crashing. Deriving rather than reusing keeps this key separate from
 * Supabase's own. Rotating the Supabase key signs everyone out, which is why
 * setting AUTH_SECRET explicitly is still the better setup.
 */
function resolveAuthSecret(): string | undefined {
  const explicit = process.env.AUTH_SECRET ?? process.env.NEXTAUTH_SECRET;
  if (explicit) return explicit;

  const derivedFrom =
    process.env.SUPABASE_JWT_SECRET ??
    process.env.SUPABASE_SECRET_KEY ??
    process.env.SUPABASE_SERVICE_ROLE_KEY;
  if (!derivedFrom) return undefined; // Auth.js raises its own MissingSecret.

  return createHash("sha256")
    .update(`kasi-erp/auth-secret/v1:${derivedFrom}`)
    .digest("hex");
}

/**
 * The half of the Auth.js config that carries no database or crypto imports.
 *
 * `proxy.ts` runs on every matched request and only needs to read the JWT, so
 * it builds its own NextAuth instance from this config. Importing the full
 * `@/auth` there would pull in Prisma and bcryptjs, opening a second
 * connection pool per proxy instance and inflating the cold start, purely to
 * decode a cookie.
 *
 * `providers` is intentionally empty here — `@/auth` supplies the real one.
 */
export const authConfig = {
  secret: resolveAuthSecret(),
  session: { strategy: "jwt" },
  pages: {
    signIn: "/login",
  },
  providers: [],
  callbacks: {
    jwt: async ({ token, user }) => {
      if (user) {
        token.mustResetPassword = (
          user as { mustResetPassword?: boolean }
        ).mustResetPassword;
      }
      return token;
    },
    session: async ({ session, token }) => {
      if (session.user) {
        session.user.id = token.sub as string;
        session.user.mustResetPassword = Boolean(token.mustResetPassword);
      }
      return session;
    },
  },
} satisfies NextAuthConfig;
