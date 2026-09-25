import { NextResponse } from "next/server";
import { recordAudit } from "@/lib/audit";
import {
  enrichFromOrderStatus,
  getSelcomConfig,
  upsertCollection,
  verifyRelayToken,
  verifySelcomCallback,
} from "@/lib/integrations/selcom";

/**
 * Receives Selcom checkout payment callbacks.
 *
 * Selcom sends each callback to the `webhook` URL given when the order was
 * created, and STS's billing system creates the orders. So there are two
 * ways to feed KASI in real time:
 *
 * 1. The billing system forwards every Selcom callback it receives to this
 *    URL unchanged (same JSON body, same Digest/Timestamp/Signed-Fields
 *    headers). The Selcom signature still verifies because KASI holds the
 *    same API secret. This is the recommended setup.
 * 2. The billing system posts its own JSON in Selcom's shape with the header
 *    `X-KASI-Relay-Token: <SELCOM_RELAY_TOKEN>`.
 *
 * Anything else is rejected. The scheduled sync (/api/cron/tick) backs this
 * up by pulling Selcom's order list, so a missed callback is only late,
 * never lost.
 */
export async function POST(request: Request) {
  const contentType = request.headers.get("content-type") ?? "";
  let body: Record<string, unknown>;
  try {
    body = contentType.includes("application/x-www-form-urlencoded")
      ? Object.fromEntries(new URLSearchParams(await request.text()))
      : ((await request.json()) as Record<string, unknown>);
  } catch {
    return NextResponse.json({ result: "FAIL", resultcode: "400", message: "Invalid body" }, { status: 400 });
  }

  const config = getSelcomConfig();
  const trusted =
    (config && verifySelcomCallback(request.headers, body, config.apiSecret)) ||
    verifyRelayToken(request.headers);
  if (!trusted) {
    return NextResponse.json({ result: "FAIL", resultcode: "401", message: "Signature not valid" }, { status: 401 });
  }

  try {
    const { row } = await upsertCollection(body, "webhook");
    // Callbacks usually carry no amount; fetch it so today's total is right.
    if (row.amount === null && config) {
      await enrichFromOrderStatus(row.orderId).catch((error) =>
        console.error("Selcom order-status lookup failed", error),
      );
    }
    await recordAudit({
      entityType: "selcom_collection",
      entityId: row.id,
      action: "webhook",
      afterData: { orderId: row.orderId, status: row.paymentStatus, transId: row.transId },
    });
  } catch (error) {
    console.error("Selcom webhook ingestion failed", error);
    return NextResponse.json({ result: "FAIL", resultcode: "422", message: "Could not record payment" }, { status: 422 });
  }

  return NextResponse.json({ result: "SUCCESS", resultcode: "000", message: "Received" });
}
