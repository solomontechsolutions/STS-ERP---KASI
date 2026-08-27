import { timingSafeEqual } from "node:crypto";
import { NextResponse } from "next/server";
import { prisma } from "@/lib/prisma";
import { runSeed, type SeedCredential } from "@/lib/seed";

/**
 * One-time bootstrap for a fresh deployment.
 *
 * A newly deployed database has no company record, no roles and no users, so
 * there is nobody who could log in to create them — the seed has to run from
 * outside the app's own authentication. This route is that door, and it is
 * deliberately a narrow one:
 *
 * - It does nothing unless SETUP_TOKEN is set, so it is inert by default.
 * - The token is compared in constant time, and must be long enough to not be
 *   worth guessing.
 * - The seed underneath is idempotent, so a second visit creates nothing and
 *   reissues no passwords.
 *
 * Delete SETUP_TOKEN once the passwords have been collected; the route then
 * refuses every request. The proxy does not guard /api/*, which is what lets
 * this be reachable before any user exists — so the token is the only thing
 * protecting it.
 */
export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const MIN_TOKEN_LENGTH = 16;

function tokensMatch(provided: string, expected: string): boolean {
  const a = Buffer.from(provided);
  const b = Buffer.from(expected);
  // timingSafeEqual throws on a length mismatch, which would itself leak the
  // expected length, so compare lengths separately and always run the check.
  if (a.length !== b.length) return false;
  return timingSafeEqual(a, b);
}

function page(title: string, bodyHtml: string, status: number) {
  const html = `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="robots" content="noindex">
<title>${title} — KASI setup</title>
<style>
  :root { color-scheme: light dark; }
  body { font-family: ui-sans-serif, system-ui, -apple-system, "Segoe UI", sans-serif;
         line-height: 1.5; margin: 0; padding: 2rem 1.25rem; }
  main { max-width: 44rem; margin: 0 auto; }
  h1 { font-size: 1.4rem; margin: 0 0 .75rem; }
  p { margin: 0 0 1rem; }
  table { border-collapse: collapse; width: 100%; margin: 1rem 0; font-size: .95rem; }
  th, td { text-align: left; padding: .5rem .6rem; border-bottom: 1px solid rgba(128,128,128,.35); }
  code, td.pw { font-family: ui-monospace, SFMono-Regular, Menlo, monospace; }
  .warn { border-left: 3px solid #d97706; padding: .5rem 0 .5rem .9rem; }
  ol { padding-left: 1.2rem; } li { margin-bottom: .4rem; }
</style>
</head>
<body><main><h1>${title}</h1>${bodyHtml}</main></body>
</html>`;

  return new NextResponse(html, {
    status,
    headers: {
      "Content-Type": "text/html; charset=utf-8",
      "Cache-Control": "no-store, max-age=0",
      "X-Robots-Tag": "noindex, nofollow",
      "Referrer-Policy": "no-referrer",
    },
  });
}

function escapeHtml(value: string): string {
  return value.replace(
    /[&<>"']/g,
    (c) =>
      ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]!,
  );
}

function credentialsTable(credentials: SeedCredential[]): string {
  const rows = credentials
    .map(
      (c) =>
        `<tr><td>${escapeHtml(c.email)}</td><td class="pw">${escapeHtml(c.password)}</td></tr>`,
    )
    .join("");
  return `<table><thead><tr><th>Email</th><th>Temporary password</th></tr></thead><tbody>${rows}</tbody></table>`;
}

export async function GET(request: Request) {
  const expected = process.env.SETUP_TOKEN;

  if (!expected || expected.length < MIN_TOKEN_LENGTH) {
    // Same response whether the variable is unset or too short: someone
    // probing this URL learns only that setup is not open.
    return page(
      "Setup is closed",
      `<p>This deployment is not accepting setup requests.</p>
       <p>To open it, set a <code>SETUP_TOKEN</code> environment variable of at least
       ${MIN_TOKEN_LENGTH} characters and redeploy.</p>`,
      404,
    );
  }

  const provided = new URL(request.url).searchParams.get("token") ?? "";
  if (!tokensMatch(provided, expected)) {
    return page(
      "Not authorised",
      `<p>That setup link is not valid. Check the <code>token</code> value against
       the <code>SETUP_TOKEN</code> set for this deployment.</p>`,
      401,
    );
  }

  let result;
  try {
    result = await runSeed(prisma);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    return page(
      "Setup failed",
      `<p>Nothing was changed beyond any records listed below.</p>
       <p><code>${escapeHtml(message)}</code></p>`,
      500,
    );
  }

  if (result.credentials.length === 0) {
    return page(
      "Already set up",
      `<p>Every record already exists, so nothing was created and no passwords were
       reissued.</p>
       <p>If you have lost the temporary passwords, reset them from
       <strong>Settings &rarr; Users &amp; access</strong> rather than re-running setup.</p>
       <p class="warn">You can now delete the <code>SETUP_TOKEN</code> environment
       variable.</p>`,
      200,
    );
  }

  return page(
    "Setup complete",
    `<p>Created the company record, the roles, and
     ${result.credentials.length} user${result.credentials.length === 1 ? "" : "s"}.</p>
     <p class="warn"><strong>Copy these passwords now.</strong> They are not stored
     anywhere and cannot be shown again. Each one works once — every user is asked
     to choose a new password on first sign-in.</p>
     ${credentialsTable(result.credentials)}
     <p>Next:</p>
     <ol>
       <li>Send each person their password privately — not in a group chat.</li>
       <li>Delete the <code>SETUP_TOKEN</code> environment variable in Vercel.</li>
       <li>Sign in at <a href="/login">/login</a>.</li>
     </ol>`,
    200,
  );
}
