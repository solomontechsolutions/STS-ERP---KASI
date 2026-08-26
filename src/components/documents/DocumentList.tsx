import { FileText } from "lucide-react";
import { listDocuments } from "@/lib/documents";
import { EmptyState } from "@/components/ui/empty-state";

function formatBytes(bytes: number) {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export async function DocumentList({
  entityType,
  entityId,
}: {
  entityType: string;
  entityId: string;
}) {
  const docs = await listDocuments(entityType, entityId);

  if (docs.length === 0) {
    return (
      <EmptyState
        icon={FileText}
        title="No documents yet"
        description="Nothing has been uploaded for this record."
      />
    );
  }

  return (
    <ul className="divide-y divide-border rounded-lg border border-border bg-surface">
      {docs.map((doc) => (
        <li key={doc.id} className="flex items-center justify-between px-4 py-3">
          <div className="min-w-0">
            <a
              href={`/api/documents/${doc.id}`}
              target="_blank"
              rel="noreferrer"
              className="text-sm font-medium text-primary hover:underline truncate block"
            >
              {doc.filename}
            </a>
            <p className="text-xs text-muted-foreground">
              {doc.category} · {formatBytes(doc.sizeBytes)} · uploaded by{" "}
              {doc.uploadedBy.name} on{" "}
              {doc.createdAt.toLocaleDateString("en-GB", {
                day: "2-digit",
                month: "short",
                year: "numeric",
              })}
            </p>
          </div>
        </li>
      ))}
    </ul>
  );
}
