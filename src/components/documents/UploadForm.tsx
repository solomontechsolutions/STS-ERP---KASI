"use client";

import { useRef, useState, useTransition } from "react";

export function UploadForm({
  action,
  categories,
}: {
  action: (formData: FormData) => Promise<void>;
  categories: string[];
}) {
  const formRef = useRef<HTMLFormElement>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);

  return (
    <form
      ref={formRef}
      action={(formData) => {
        setError(null);
        startTransition(async () => {
          try {
            await action(formData);
            formRef.current?.reset();
          } catch (err) {
            setError(err instanceof Error ? err.message : "Upload failed");
          }
        });
      }}
      className="flex flex-wrap items-end gap-3 rounded-lg border border-border bg-surface p-4"
    >
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          Category
        </label>
        <select
          name="category"
          className="rounded-md border border-border px-2.5 py-1.5 text-sm"
          defaultValue={categories[0]}
        >
          {categories.map((c) => (
            <option key={c} value={c}>
              {c}
            </option>
          ))}
        </select>
      </div>
      <div>
        <label className="block text-xs font-medium text-muted-foreground mb-1">
          File
        </label>
        <input
          type="file"
          name="file"
          required
          className="text-sm file:mr-3 file:rounded-md file:border-0 file:bg-primary file:px-3 file:py-1.5 file:text-sm file:text-primary-foreground file:cursor-pointer"
        />
      </div>
      <button
        type="submit"
        disabled={isPending}
        className="rounded-md bg-primary px-3 py-1.5 text-sm font-medium text-primary-foreground hover:opacity-90 disabled:opacity-50 transition-opacity"
      >
        {isPending ? "Uploading…" : "Upload"}
      </button>
      {error && <p className="w-full text-sm text-status-danger">{error}</p>}
    </form>
  );
}
