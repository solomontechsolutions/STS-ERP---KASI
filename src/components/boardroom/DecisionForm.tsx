"use client";

import { useActionState, useState } from "react";
import { createDecisionAction, type FormState } from "@/lib/actions/decisions";
import { FormMessage, SubmitButton, TzOffsetInput, inputClass } from "@/components/ui/form";

type Electorate = { name: string; weight: number }[];

export function DecisionForm({
  directors,
  shareholders,
  meetings,
  defaultClosesAt,
}: {
  directors: Electorate;
  shareholders: Electorate;
  meetings: { id: string; label: string }[];
  defaultClosesAt: string;
}) {
  const [state, action] = useActionState<FormState, FormData>(createDecisionAction, {});
  const [category, setCategory] = useState("board_resolution");
  const electorate = category === "shareholder_resolution" ? shareholders : directors;

  return (
    <form action={action} className="space-y-5">
      <TzOffsetInput />
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input name="title" required className={inputClass} placeholder="e.g. Approve purchase of 40 access points for SAUT phase 2" />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Background</label>
        <textarea name="background" required rows={5} className={inputClass} placeholder="Why this is needed, costs, options considered, risks." />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Resolution (what the company will do if passed)</label>
        <textarea name="proposedAction" required rows={3} className={inputClass} placeholder="RESOLVED THAT the company…" />
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label className="block text-sm font-medium mb-1">Type</label>
          <select name="category" value={category} onChange={(e) => setCategory(e.target.value)} className={inputClass}>
            <option value="board_resolution">Board resolution (one vote per director)</option>
            <option value="shareholder_resolution">Shareholder resolution (weighted by shares)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Required majority</label>
          <select name="threshold" defaultValue="simple_majority" className={inputClass}>
            <option value="simple_majority">Simple majority (more than 50%)</option>
            <option value="special_75">Special resolution (at least 75%)</option>
            <option value="unanimous">Unanimous (100%)</option>
          </select>
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Voting closes</label>
          <input type="datetime-local" name="closesAt" required defaultValue={defaultClosesAt} className={inputClass} />
        </div>
        <div>
          <label className="block text-sm font-medium mb-1">Linked meeting (optional)</label>
          <select name="meetingId" defaultValue="" className={inputClass}>
            <option value="">None</option>
            {meetings.map((m) => (
              <option key={m.id} value={m.id}>{m.label}</option>
            ))}
          </select>
        </div>
      </div>

      <div className="rounded-md bg-background p-4 text-sm">
        <p className="font-medium mb-2">Who votes</p>
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-x-6 gap-y-1">
          {electorate.map((e) => (
            <li key={e.name} className="flex justify-between gap-2">
              <span>{e.name}</span>
              <span className="font-tabular text-muted-foreground">
                {category === "shareholder_resolution" ? `${e.weight}%` : "1 vote"}
              </span>
            </li>
          ))}
        </ul>
        <p className="mt-3 text-xs text-muted-foreground text-justify">
          Every founder can see this decision, the votes and the discussion. A decision passes
          when votes in favour reach the required share of ALL voting rights, not only of those
          who voted, and closes early once the result is certain.
        </p>
      </div>

      <FormMessage error={state.error} />
      <SubmitButton pendingLabel="Tabling…">Table decision and notify founders</SubmitButton>
    </form>
  );
}
