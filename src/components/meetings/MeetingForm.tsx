"use client";

import { useActionState, useState } from "react";
import { createMeetingAction, type FormState } from "@/lib/actions/meetings";
import { FormMessage, SubmitButton, TzOffsetInput, inputClass } from "@/components/ui/form";

export function MeetingForm({
  people,
  canCallBoardMeetings,
  defaultStart,
}: {
  people: { id: string; name: string }[];
  canCallBoardMeetings: boolean;
  defaultStart: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(createMeetingAction, {});
  const [kind, setKind] = useState(canCallBoardMeetings ? "board" : "management");
  const boardKind = kind === "board" || kind === "shareholders";

  return (
    <form action={action} className="space-y-5">
      <TzOffsetInput />
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input name="title" required className={inputClass} placeholder="e.g. Q3 board meeting" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select name="kind" value={kind} onChange={(e) => setKind(e.target.value)} className={inputClass}>
            {canCallBoardMeetings && <option value="board">Board meeting</option>}
            {canCallBoardMeetings && <option value="shareholders">Shareholders&apos; meeting</option>}
            <option value="management">Management meeting</option>
            <option value="general">General meeting</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Starts</label>
          <input type="datetime-local" name="scheduledAt" required defaultValue={defaultStart} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Duration</label>
          <select name="durationMinutes" defaultValue="60" className={inputClass}>
            {[15, 30, 45, 60, 90, 120, 180].map((m) => (
              <option key={m} value={m}>{m} minutes</option>
            ))}
          </select>
        </div>
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Agenda</label>
        <textarea name="agenda" required rows={6} className={inputClass} placeholder={"1. Opening and quorum\n2. Confirmation of previous minutes\n3. …"} />
      </div>

      {boardKind ? (
        <p className="rounded-md bg-background p-3 text-sm text-muted-foreground">
          All directors and shareholders are invited automatically.
        </p>
      ) : (
        <fieldset>
          <legend className="text-sm font-medium mb-2">Invite</legend>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 max-h-64 overflow-y-auto rounded-md border border-border p-3">
            {people.map((p) => (
              <label key={p.id} className="flex items-center gap-2 text-sm">
                <input type="checkbox" name="invitees" value={p.id} /> {p.name}
              </label>
            ))}
          </div>
        </fieldset>
      )}

      <FormMessage error={state.error} />
      <SubmitButton pendingLabel="Scheduling…">Schedule and send invites</SubmitButton>
    </form>
  );
}
