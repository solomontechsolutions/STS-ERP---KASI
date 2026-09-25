"use client";

import { useActionState, useEffect, useRef } from "react";
import { addDecisionCommentAction, type FormState } from "@/lib/actions/decisions";
import { FormMessage, SubmitButton, inputClass } from "@/components/ui/form";

export function CommentForm({ decisionId }: { decisionId: string }) {
  const [state, action] = useActionState<FormState, FormData>(addDecisionCommentAction, {});
  const formRef = useRef<HTMLFormElement>(null);
  useEffect(() => {
    if (state.ok) formRef.current?.reset();
  }, [state]);

  return (
    <form ref={formRef} action={action} className="space-y-2">
      <input type="hidden" name="decisionId" value={decisionId} />
      <textarea name="body" rows={3} required placeholder="Add to the discussion…" className={inputClass} />
      <FormMessage error={state.error} />
      <SubmitButton variant="secondary" pendingLabel="Posting…">Post comment</SubmitButton>
    </form>
  );
}
