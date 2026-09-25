"use server";

import { revalidatePath } from "next/cache";
import { auth } from "@/auth";
import { userHasPermission } from "@/lib/permissions";
import { recordAudit } from "@/lib/audit";
import { syncSelcomOrders } from "@/lib/integrations/selcom";

export type SyncState = { error?: string; message?: string };

export async function syncSelcomNowAction(
  _prev: SyncState,
  formData: FormData,
): Promise<SyncState> {
  const session = await auth();
  if (!session?.user) return { error: "Your session has expired. Sign in again." };
  const allowed =
    (await userHasPermission(session.user.id, "banking", "edit")) ||
    (await userHasPermission(session.user.id, "sales_subscriber", "edit"));
  if (!allowed) return { error: "You don't have permission to run a Selcom sync." };

  const days = Math.min(90, Math.max(1, Number(formData.get("days") ?? 2)));
  const to = new Date();
  const from = new Date(to.getTime() - (days - 1) * 24 * 60 * 60 * 1000);

  try {
    const run = await syncSelcomOrders({
      from,
      to,
      trigger: "manual",
      triggeredById: session.user.id,
    });
    await recordAudit({
      entityType: "integration_sync_run",
      entityId: run.id,
      action: "sync",
      actorId: session.user.id,
      afterData: { provider: "selcom", fetched: run.fetched, upserted: run.upserted, days },
    });
    revalidatePath("/finance/collections");
    return { message: `Synced ${run.upserted} order${run.upserted === 1 ? "" : "s"} from the last ${days} day${days === 1 ? "" : "s"}.` };
  } catch (error) {
    revalidatePath("/finance/collections");
    return { error: error instanceof Error ? error.message : "Sync failed." };
  }
}
