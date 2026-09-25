import { headers } from "next/headers";

/** Client IP and user agent of the current request, for audit evidence. */
export async function getRequestMeta() {
  const h = await headers();
  const forwarded = h.get("x-forwarded-for");
  const ipAddress = forwarded?.split(",")[0]?.trim() || h.get("x-real-ip") || null;
  return { ipAddress, userAgent: h.get("user-agent") };
}
