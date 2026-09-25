"use client";

import { useActionState } from "react";
import { RefreshCw } from "lucide-react";
import { syncSelcomNowAction, type SyncState } from "@/lib/actions/collections";
import { FormMessage, SubmitButton, inputClass } from "@/components/ui/form";

export function SyncForm() {
  const [state, action] = useActionState<SyncState, FormData>(syncSelcomNowAction, {});
  return (
    <form action={action} className="space-y-3">
      <div className="flex flex-wrap items-end gap-3">
        <label className="text-sm">
          <span className="block font-medium mb-1">Read Selcom orders from the last</span>
          <select name="days" defaultValue="2" className={inputClass + " w-40"}>
            <option value="1">1 day</option>
            <option value="2">2 days</option>
            <option value="7">7 days</option>
            <option value="31">31 days</option>
            <option value="90">90 days</option>
            <option value="366">12 months</option>
          </select>
        </label>
        <SubmitButton pendingLabel="Reading from Selcom…" variant="secondary">
          <RefreshCw className="h-4 w-4" /> Refresh from Selcom
        </SubmitButton>
      </div>
      <FormMessage error={state.error} success={state.message} />
    </form>
  );
}
