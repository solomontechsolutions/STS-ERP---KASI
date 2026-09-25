/**
 * The address KASI is served from.
 *
 * KASI_CANONICAL_HOST (e.g. erp.solomontechsolutions.com) is the one host
 * people should use. Every other company host, such as
 * erp.solomontechsolutions.co.tz, is redirected to it by src/proxy.ts.
 *
 * One host matters for more than tidiness: a passkey (Face ID, fingerprint)
 * is bound to the domain it was created on, and sign-in cookies are too. A
 * person who registered Face ID on .com could not use it on .co.tz.
 */
export function canonicalHost(): string | null {
  const host = process.env.KASI_CANONICAL_HOST?.trim().toLowerCase();
  return host ? host.replace(/^https?:\/\//, "").replace(/\/.*$/, "") : null;
}

/** Hosts that never redirect: local development and Vercel preview links. */
export function isDevelopmentHost(host: string): boolean {
  const name = host.split(":")[0].toLowerCase();
  return name === "localhost" || name === "127.0.0.1" || name.endsWith(".vercel.app");
}
