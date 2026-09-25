import { NextResponse } from "next/server";
import NextAuth from "next-auth";
import { authConfig } from "@/auth.config";
import { canonicalHost, isDevelopmentHost } from "@/lib/site";

// Built from the database-free half of the config on purpose — see
// src/auth.config.ts. The proxy only decodes the session cookie.
const { auth } = NextAuth(authConfig);

const PUBLIC_PATHS = ["/login"];

export default auth((req) => {
  const { pathname } = req.nextUrl;

  // One address for KASI (see src/lib/site.ts): anything else, e.g. the
  // .co.tz domain, is sent to the same page on the canonical host.
  const canonical = canonicalHost();
  const host = (req.headers.get("x-forwarded-host") ?? req.headers.get("host") ?? "").split(",")[0].trim().toLowerCase();
  if (canonical && host && host !== canonical && !isDevelopmentHost(host)) {
    const target = new URL(`${pathname}${req.nextUrl.search}`, `https://${canonical}`);
    return NextResponse.redirect(target, 308);
  }

  const isPublicPath = PUBLIC_PATHS.some((p) => pathname.startsWith(p));
  const isAuthed = Boolean(req.auth);

  if (!isAuthed && !isPublicPath) {
    const loginUrl = new URL("/login", req.nextUrl.origin);
    loginUrl.searchParams.set("callbackUrl", pathname);
    return NextResponse.redirect(loginUrl);
  }

  if (isAuthed && isPublicPath) {
    return NextResponse.redirect(new URL("/", req.nextUrl.origin));
  }

  if (
    isAuthed &&
    req.auth?.user.mustResetPassword &&
    pathname !== "/reset-password"
  ) {
    return NextResponse.redirect(new URL("/reset-password", req.nextUrl.origin));
  }

  return NextResponse.next();
});

// The manifest, service worker and icons are fetched by the browser and the
// OS without the session cookie (e.g. when installing to an iPhone home
// screen), so they must never be redirected to /login.
export const config = {
  matcher: [
    "/((?!api|_next/static|_next/image|favicon.ico|manifest.webmanifest|sw.js|icons/).*)",
  ],
};
