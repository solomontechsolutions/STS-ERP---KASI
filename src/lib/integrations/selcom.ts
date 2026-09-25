import { createHmac } from "node:crypto";
import { Prisma } from "@prisma/client";
import { prisma } from "@/lib/prisma";

/**
 * Read-only Selcom API client behind the revenue reports.
 *
 * KASI never creates, changes or cancels a payment. BillNasi (the billing
 * system) creates every Selcom order and receives Selcom's callbacks; KASI
 * only reads the same account's order list with the same API credentials
 * and stores a copy for reporting.
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
 * earlier value, and `paidAt` is set the first time the order is COMPLETED
 * and never moved after that.
 */
export async function upsertCollection(
  payload: SelcomOrderPayload,
  source: "sync",
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

  // Selcom's list gives the order's creation time, which for a mobile money
  // checkout is minutes from payment. Using it (not the sync time) keeps an
  // import of last month's orders out of today's figures.
  const orderDate = fields.orderCreatedAt ?? existing?.orderCreatedAt ?? undefined;
  const paidAt =
    existing?.paidAt ?? (status === "COMPLETED" ? orderDate ?? new Date() : null);

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

  return row;
}

function ymd(date: Date): string {
  // Selcom's list filter is by EAT calendar day.
  return new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

const DAY_MS = 24 * 60 * 60 * 1000;
/** Days per list-orders request, so a long import is several small calls. */
const CHUNK_DAYS = 7;

/**
 * Copies every checkout order in a date range from Selcom into KASI. Long
 * ranges are fetched a week at a time. Re-running a range is safe: orders
 * are matched on Selcom's order_id and updated, never duplicated.
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
    let fetched = 0;
    let upserted = 0;
    for (let start = opts.from.getTime(); start <= opts.to.getTime(); start += CHUNK_DAYS * DAY_MS) {
      const end = Math.min(start + (CHUNK_DAYS - 1) * DAY_MS, opts.to.getTime());
      const params = { fromdate: ymd(new Date(start)), todate: ymd(new Date(end)) };
      const res = await selcomGet(config, "checkout/list-orders", params);
      if (res.resultcode && res.resultcode !== "000") {
        throw new Error(`Selcom list-orders: ${res.result ?? ""} ${res.message ?? res.resultcode}`.trim());
      }
      const orders = Array.isArray(res.data) ? (res.data as SelcomOrderPayload[]) : [];
      fetched += orders.length;
      for (const order of orders) {
        if (!str(order.order_id)) continue;
        await upsertCollection(order, "sync");
        upserted++;
      }
    }

    return await prisma.integrationSyncRun.update({
      where: { id: run.id },
      data: { status: "success", fetched, upserted, finishedAt: new Date() },
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

/** EAT calendar date (yyyy-mm-dd) of an instant. */
export function eatDateKey(date: Date): string {
  return new Date(date.getTime() + 3 * 60 * 60 * 1000).toISOString().slice(0, 10);
}

/** Midnight EAT at the start of a yyyy-mm-dd date. */
export function eatDayStart(key: string): Date {
  return new Date(`${key}T00:00:00+03:00`);
}

export type RevenueReport = {
  from: Date;
  toExclusive: Date;
  total: number;
  count: number;
  average: number;
  unsuccessful: number;
  pending: number;
  days: { date: string; amount: number; count: number }[];
  channels: { channel: string; amount: number; count: number; share: number }[];
};

/**
 * Successful Selcom payments between two instants, with daily and
 * per-channel breakdowns. Days with no payments are included as zero so
 * the report and its chart show gaps honestly.
 */
export async function revenueReport(from: Date, toExclusive: Date): Promise<RevenueReport> {
  // Aggregated in SQL: a year of Wi-Fi voucher payments is far too many rows
  // to load. "paidAt" is stored as UTC; convert before cutting into days.
  const [dailyRows, channelRows, unsuccessful, pending] = await Promise.all([
    prisma.$queryRaw<{ day: string; amount: string | null; count: bigint }[]>`
      SELECT to_char(("paidAt" AT TIME ZONE 'UTC') AT TIME ZONE 'Africa/Dar_es_Salaam', 'YYYY-MM-DD') AS day,
             SUM("amount")::text AS amount,
             COUNT(*) AS count
      FROM "SelcomCollection"
      WHERE "paymentStatus" = 'COMPLETED' AND "paidAt" >= ${from} AND "paidAt" < ${toExclusive}
      GROUP BY 1`,
    prisma.selcomCollection.groupBy({
      by: ["channel"],
      where: { paymentStatus: "COMPLETED", paidAt: { gte: from, lt: toExclusive } },
      _sum: { amount: true },
      _count: true,
    }),
    prisma.selcomCollection.count({
      where: {
        paymentStatus: { in: ["CANCELLED", "USERCANCELED", "REJECTED", "FAILED"] },
        orderCreatedAt: { gte: from, lt: toExclusive },
      },
    }),
    prisma.selcomCollection.count({
      where: {
        paymentStatus: { in: ["PENDING", "INPROGRESS"] },
        orderCreatedAt: { gte: from, lt: toExclusive },
      },
    }),
  ]);

  const byDay = new Map<string, { amount: number; count: number }>();
  for (let t = from.getTime(); t < toExclusive.getTime(); t += DAY_MS) {
    byDay.set(eatDateKey(new Date(t)), { amount: 0, count: 0 });
  }
  for (const r of dailyRows) {
    byDay.set(r.day, { amount: Number(r.amount ?? 0), count: Number(r.count) });
  }
  const days = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, v]) => ({ date, ...v }));
  const total = days.reduce((n, d) => n + d.amount, 0);
  const count = days.reduce((n, d) => n + d.count, 0);

  return {
    from,
    toExclusive,
    total,
    count,
    average: count ? total / count : 0,
    unsuccessful,
    pending,
    days,
    channels: channelRows
      .map((c) => {
        const amount = Number(c._sum.amount ?? 0);
        return { channel: c.channel ?? "Unknown", amount, count: c._count, share: total ? amount / total : 0 };
      })
      .sort((a, b) => b.amount - a.amount),
  };
}

export function formatTzs(amount: number): string {
  return `TZS ${amount.toLocaleString("en-US", { maximumFractionDigits: 0 })}`;
}
