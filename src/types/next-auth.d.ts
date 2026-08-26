import type { DefaultSession } from "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      mustResetPassword: boolean;
    } & DefaultSession["user"];
  }

  interface User {
    mustResetPassword?: boolean;
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    mustResetPassword?: boolean;
  }
}
