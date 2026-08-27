import type { NextAuthConfig } from "next-auth";

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
