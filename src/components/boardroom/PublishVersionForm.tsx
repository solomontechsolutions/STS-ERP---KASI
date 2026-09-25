"use client";

import { useActionState } from "react";
import { publishAgreementVersionAction, type FormState } from "@/lib/actions/agreements";
import { FormMessage, SubmitButton, inputClass } from "@/components/ui/form";

export function PublishVersionForm({
  code,
  title,
  summary,
  body,
  nextVersion,
}: {
  code: string;
  title: string;
  summary: string;
  body: string;
  nextVersion: number;
}) {
  const [state, action] = useActionState<FormState, FormData>(publishAgreementVersionAction, {});
  return (
    <form action={action} className="space-y-4">
      <input type="hidden" name="code" value={code} />
      <div>
        <label className="block text-sm font-medium mb-1">Title</label>
        <input name="title" defaultValue={title} required className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Summary</label>
        <input name="summary" defaultValue={summary} required className={inputClass} />
      </div>
      <div>
        <label className="block text-sm font-medium mb-1">Agreement text</label>
        <textarea
          name="body"
          defaultValue={body}
          required
          rows={28}
          className={inputClass + " font-mono text-xs leading-relaxed"}
        />
      </div>
      <p className="text-sm text-status-warning text-justify">
        Publishing creates version {nextVersion}. Every director and shareholder is notified and
        must sign it again. Signatures on earlier versions are kept as history.
      </p>
      <FormMessage error={state.error} />
      <SubmitButton pendingLabel="Publishing…">Publish version {nextVersion}</SubmitButton>
    </form>
  );
}
