import { createHmac, timingSafeEqual } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Selcom API gateway client and collection ledger.
 *
 * Signing follows Selcom's own reference client
 * (github.com/selcompaytechltd/selcom-apigw-client-php):
 *
 *   Authorization: SELCOM base64(apiKey)
 *   Timestamp:     ISO-8601 time, e.g. 2026-09-25T14:03:11+03:00
 *   Signed-Fields: comma-separated names of the signed fields, in order
 *   Digest:        base64(HMAC-SHA256(apiSecret,
 *                    "timestamp=<Timestamp>&f1=v1&f2=v2..."))
 *   Digest-Method: HS256
 *
 * Selcom signs its webhook callbacks the same way, so the same function
 * verifies an incoming callback. That also means the billing system can
 * forward the raw Selcom callback (body plus those headers) to KASI and the
 * signature still verifies, because both systems share the one API secret.
 */

export type SelcomConfig = {
  baseUrl: string;
  apiKey: string;
  apiSecret: string;
  vendor?: string;
};

export function getSelcomConfig(): SelcomConfig | null {
  const apiKey = process.env.SELCOM_API_KEY;
  const apiSecret = process.env.SELCOM_API_SECRET;
  if (!apiKey || !apiSecret) return null;
  const live = (process.env.SELCOM_LIVE ?? "true").toLowerCase() !== "false";
  return {
    baseUrl:
      process.env.SELCOM_BASE_URL?.replace(/\/+$/, "") ||
      `https://${live ? "apigw" : "apigwtest"}.selcommobile.com/v1`,
    apiKey,
    apiSecret,
    vendor: process.env.SELCOM_VENDOR || undefined,
  };
}

/** Selcom's reference client formats the timestamp in East Africa Time. */
function eatTimestamp(date = new Date()): string {
  const eat = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  return `${eat.toISOString().slice(0, 19)}+03:00`;
}

export function computeDigest(
  secret: string,
  timestamp: string,
  fields: [string, unknown][],
): string {
  let data = `timestamp=${timestamp}`;
  for (const [key, value] of fields) data += `&${key}=${value == null ? "" : String(value)}`;
  return createHmac("sha256", secret).update(data).digest("base64");
}

export function signRequest(config: SelcomConfig, params: Record<string, string>) {
  const timestamp = eatTimestamp();
  const fields = Object.entries(params);
  return {
    "Content-Type": "application/json",
    Authorization: `SELCOM ${Buffer.from(config.apiKey).toString("base64")}`,
    "Digest-Method": "HS256",
    Digest: computeDigest(config.apiSecret, timestamp, fields),
    Timestamp: timestamp,
    "Signed-Fields": fields.map(([k]) => k).join(","),
  };
}

function safeEqual(a: string, b: string): boolean {
  const ab = Buffer.from(a);
  const bb = Buffer.from(b);
  return ab.length === bb.length && timingSafeEqual(ab, bb);
}

/**
 * Verifies a Selcom-signed callback. Rejects a timestamp more than
 * `maxAgeHours` old so a captured callback cannot be replayed indefinitely
 * (replays are harmless anyway: ingestion is an idempotent upsert).
 */
export function verifySelcomCallback(
  headers: Headers,
  body: Record<string, unknown>,
  secret: string,
  maxAgeHours = 48,
): boolean {
  const digest = headers.get("digest");
  const timestamp = headers.get("timestamp");
  const signedFields = headers.get("signed-fields");
  if (!digest || !timestamp || !signedFields) return false;

  const sentAt = Date.parse(timestamp);
  if (Number.isNaN(sentAt)) return false;
  if (Math.abs(Date.now() - sentAt) > maxAgeHours * 60 * 60 * 1000) return false;

  const fields = signedFields
    .split(",")
    .map((f) => f.trim())
    .filter(Boolean)
    .map((f) => [f, body[f]] as [string, unknown]);
  return safeEqual(computeDigest(secret, timestamp, fields), digest);
}

/** Alternative to a Selcom signature for relays that re-shape the payload. */
export function verifyRelayToken(headers: Headers): boolean {
  const expected = process.env.SELCOM_RELAY_TOKEN;
  if (!expected || expected.length < 16) return false;
  const bearer = headers.get("authorization")?.replace(/^Bearer\s+/i, "");
  const provided = headers.get("x-kasi-relay-token") ?? bearer;
  return Boolean(provided && safeEqual(provided, expected));
}

async function selcomGet(config: SelcomConfig, path: string, params: Record<string, string>) {
  const url = `${config.baseUrl}/${path}?${new URLSearchParams(params)}`;
  const res = await fetch(url, {
    headers: signRequest(config, params),
    cache: "no-store",
    signal: AbortSignal.timeout(30_000),
  });
  const text = await res.text();
  let json: unknown;
  try {
    json = JSON.parse(text);
  } catch {
    throw new Error(`Selcom ${path} returned HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  if (!res.ok) {
    throw new Error(`Selcom ${path} returned HTTP ${res.status}: ${text.slice(0, 200)}`);
  }
  return json as { resultcode?: string; result?: string; message?: string; data?: unknown };
}

// ---------------------------------------------------------------------------
// Normalizing Selcom payloads into the ledger
// ---------------------------------------------------------------------------

export type SelcomOrderPayload = Record<string, unknown>;

function str(value: unknown): string | undefined {
  if (value === null || value === undefined) return undefined;
  const s = String(value).trim();
  return s.length > 0 ? s : undefined;
}

function parseDate(value: unknown): Date | undefined {
  const s = str(value);
  if (!s) return undefined;
  // Selcom returns "2026-09-25 14:03:11" (EAT) in list responses.
  const iso = /^\d{4}-\d{2}-\d{2} \d{2}:\d{2}(:\d{2})?$/.test(s)
    ? `${s.replace(" ", "T")}+03:00`
    : s;
  const d = new Date(iso);
  return Number.isNaN(d.getTime()) ? undefined : d;
}

function parseAmount(value: unknown): Prisma.Decimal | undefined {
  const s = str(value)?.replace(/,/g, "");
  if (!s || Number.isNaN(Number(s))) return undefined;
  return new Prisma.Decimal(s);
}

export function normalizeStatus(value: unknown): string {
  return (str(value) ?? "PENDING").toUpperCase();
}

/**
 * Inserts or updates one order. Fields a later payload leaves out keep their
 * earlier value (a callback often omits the amount, a list response the
 * transid), and `paidAt` is stamped the first time the order is COMPLETED
 * and never moved after that.
 */
export async function upsertCollection(
  payload: SelcomOrderPayload,
  source: "webhook" | "sync",
) {
  const orderId = str(payload.order_id ?? payload.orderId);
  if (!orderId) throw new Error("Selcom payload has no order_id");

  const status = normalizeStatus(payload.payment_status ?? payload.status);
  const existing = await prisma.selcomCollection.findUnique({ where: { orderId } });

  const fields = {
    transId: str(payload.transid ?? payload.transaction_id),
    reference: str(payload.reference),
    channel: str(payload.channel),
    msisdn: str(payload.msisdn ?? payload.phone),
    amount: parseAmount(payload.amount),
    resultCode: str(payload.resultcode),
    orderCreatedAt: parseDate(payload.creation_date ?? payload.created_at),
  };
  const defined = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined),
  );

  // A webhook arrives as the payment happens, so "now" is the payment time.
  // A sync can import orders from weeks ago; stamping those "now" would
  // count last month's money in today's total, so use the order's own date.
  const orderDate = fields.orderCreatedAt ?? existing?.orderCreatedAt ?? undefined;
  const paidAt =
    existing?.paidAt ??
    (status === "COMPLETED"
      ? source === "sync" && orderDate
        ? orderDate
        : new Date()
      : null);

  const row = existing
    ? await prisma.selcomCollection.update({
        where: { orderId },
        data: {
          ...defined,
          // A late PENDING from a list sync must not undo a confirmed payment.
          paymentStatus: existing.paymentStatus === "COMPLETED" ? "COMPLETED" : status,
          paidAt,
          rawPayload: payload as Prisma.InputJsonValue,
        },
      })
    : await prisma.selcomCollection.create({
        data: {
          orderId,
          ...defined,
          paymentStatus: status,
          paidAt,
          source,
          rawPayload: payload as Prisma.InputJsonValue,
        },
      });

  const newlyCompleted = status === "COMPLETED" && existing?.paymentStatus !== "COMPLETED";
  return { row, newlyCompleted };
}

/** Fills in fields a callback left out (usually amount) from order-status. */
export async function enrichFromOrderStatus(orderId: string) {
  const config = getSelcomConfig();
  if (!config) return;
  const res = await selcomGet(config, "checkout/order-status", { order_id: orderId });
  const data = Array.isArray(res.data) ? res.data[0] : res.data;
  if (data && typeof data === "object") {
    await upsertCollection(data as SelcomOrderPayload, "sync");
  }
}

function ymd(date: Date): string {
  // Selcom's list filter is by EAT calendar day.
  return new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/**
 * Pulls every checkout order in a date range from Selcom and upserts it.
 * This is the safety net behind the webhook: any callback that was missed,
 * or orders made before KASI was connected, arrive through here.
 */
export async function syncSelcomOrders(opts: {
  from: Date;
  to: Date;
  trigger: "manual" | "cron";
  triggeredById?: string;
}) {
  const config = getSelcomConfig();
  if (!config) throw new Error("Selcom is not configured: set SELCOM_API_KEY and SELCOM_API_SECRET.");

  const run = await prisma.integrationSyncRun.create({
    data: {
      provider: "selcom",
      trigger: opts.trigger,
      status: "running",
      rangeFrom: opts.from,
      rangeTo: opts.to,
      triggeredById: opts.triggeredById,
    },
  });

  try {
    const params: Record<string, string> = { fromdate: ymd(opts.from), todate: ymd(opts.to) };
    const res = await selcomGet(config, "checkout/list-orders", params);
    if (res.resultcode && res.resultcode !== "000") {
      throw new Error(`Selcom list-orders: ${res.result ?? ""} ${res.message ?? res.resultcode}`.trim());
    }
    const orders = Array.isArray(res.data) ? (res.data as SelcomOrderPayload[]) : [];

    let upserted = 0;
    for (const order of orders) {
      if (!str(order.order_id)) continue;
      await upsertCollection(order, "sync");
      upserted++;
    }

    return await prisma.integrationSyncRun.update({
      where: { id: run.id },
      data: { status: "success", fetched: orders.length, upserted, finishedAt: new Date() },
    });
  } catch (error) {
    await prisma.integrationSyncRun.update({
      where: { id: run.id },
      data: {
        status: "failed",
        error: error instanceof Error ? error.message : String(error),
        finishedAt: new Date(),
      },
    });
    throw error;
  }
}

// ---------------------------------------------------------------------------
// Reporting
// ---------------------------------------------------------------------------

/** Midnight in Dar es Salaam (UTC+3, no DST) for the day containing `date`. */
export function startOfEatDay(date = new Date()): Date {
  const eat = new Date(date.getTime() + 3 * 60 * 60 * 1000);
  eat.setUTCHours(0, 0, 0, 0);
  return new Date(eat.getTime() - 3 * 60 * 60 * 1000);
}

export async function collectedSince(since: Date) {
  const agg = await prisma.selcomCollection.aggregate({
    where: { paymentStatus: "COMPLETED", paidAt: { gte: since } },
    _sum: { amount: true },
    _count: true,
  });
  return { amount: Number(agg._sum.amount ?? 0), count: agg._count };
}

export function formatTzs(amount: number): string {
  return `TZS ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
