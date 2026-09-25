"use client";

import { useActionState } from "react";
import { castVoteAction, type FormState } from "@/lib/actions/decisions";
import { FormMessage, SubmitButton, inputClass } from "@/components/ui/form";

export function VoteForm({ decisionId, weightLabel }: { decisionId: string; weightLabel: string }) {
  const [state, action] = useActionState<FormState, FormData>(castVoteAction, {});
  if (state.ok) return <FormMessage success="Your vote has been recorded." />;

  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="decisionId" value={decisionId} />
      <fieldset>
        <legend className="text-sm font-medium mb-2">Your vote ({weightLabel})</legend>
        <div className="grid grid-cols-3 gap-2">
          {[
            { value: "for", label: "For", tone: "peer-checked:bg-status-success peer-checked:border-status-success" },
            { value: "against", label: "Against", tone: "peer-checked:bg-status-danger peer-checked:border-status-danger" },
            { value: "abstain", label: "Abstain", tone: "peer-checked:bg-muted-foreground peer-checked:border-muted-foreground" },
          ].map((o) => (
            <label key={o.value} className="cursor-pointer">
              <input type="radio" name="choice" value={o.value} required className="peer sr-only" />
              <span
                className={`block rounded-md border border-border py-2.5 text-center text-sm font-medium peer-checked:text-white peer-focus-visible:ring-2 peer-focus-visible:ring-accent ${o.tone}`}
              >
                {o.label}
              </span>
            </label>
          ))}
        </div>
      </fieldset>
      <div>
        <label className="block text-sm font-medium mb-1">Reason (optional, visible to all founders)</label>
        <textarea name="comment" rows={2} className={inputClass} />
      </div>
      <p className="text-xs text-muted-foreground">Votes are final once cast and are recorded in the audit log.</p>
      <FormMessage error={state.error} />
      <SubmitButton pendingLabel="Recording…">Cast vote</SubmitButton>
    </form>
  );
}
