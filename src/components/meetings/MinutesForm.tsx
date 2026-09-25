"use client";

import { useActionState } from "react";
import { saveMinutesAction, type FormState } from "@/lib/actions/meetings";
import { FormMessage, SubmitButton, inputClass } from "@/components/ui/form";

export function MinutesForm({ meetingId, initial }: { meetingId: string; initial: string }) {
  const [state, action] = useActionState<FormState, FormData>(saveMinutesAction, {});
  return (
    <form action={action} className="space-y-3">
      <input type="hidden" name="meetingId" value={meetingId} />
      <textarea
        name="minutes"
        defaultValue={initial}
        rows={12}
        required
        className={inputClass}
        placeholder={"Present: …\nIn attendance: …\n1. Opening: the chair opened the meeting at …\n2. …\nResolutions: …\nClosure: …"}
      />
      <FormMessage error={state.error} success={state.ok ? "Minutes saved and invitees notified." : undefined} />
      <SubmitButton pendingLabel="Saving…">Save minutes</SubmitButton>
    </form>
  );
}
