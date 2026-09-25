import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { canAdministerBoardroom, getBoardMember } from "@/lib/boardroom/members";
import { EmptyState } from "@/components/ui/empty-state";
import { PublishVersionForm } from "@/components/boardroom/PublishVersionForm";
import { FileSignature } from "lucide-react";

export default async function EditAgreementPage({ params }: PageProps<"/boardroom/agreements/[id]/edit">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;

  if (!canAdministerBoardroom(await getBoardMember(session.user.id))) {
    return (
      <EmptyState
        icon={FileSignature}
        title="Not allowed"
        description="Only directors or the Company Secretary can publish agreement wording."
      />
    );
  }
  const template = await prisma.agreementTemplate.findUnique({ where: { id } });
  if (!template) notFound();
  if (!template.isCurrent) redirect(`/boardroom/agreements/${id}`);

  return (
    <div className="max-w-4xl space-y-4">
      <Link href={`/boardroom/agreements/${id}`} className="text-sm text-primary hover:underline">
        {template.title}
      </Link>
      <h1 className="text-2xl font-heading font-bold">Publish a revised version</h1>
      <p className="text-sm text-muted-foreground text-justify">
        Have the company&apos;s advocate review the wording before publishing. The current text is
        version {template.version}.
      </p>
      <section className="rounded-lg border border-border bg-surface p-5">
        <PublishVersionForm
          code={template.code}
          title={template.title}
          summary={template.summary}
          body={template.body}
          nextVersion={template.version + 1}
        />
      </section>
    </div>
  );
}
