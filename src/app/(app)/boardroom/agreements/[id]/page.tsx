import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { hashAgreementBody } from "@/lib/boardroom/agreements";
import { canAdministerBoardroom, getBoardMember, listBoardMembers } from "@/lib/boardroom/members";
import { fmtDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { SignAgreementForm } from "@/components/boardroom/SignAgreementForm";
import { PrintButton } from "@/components/ui/PrintButton";

export default async function AgreementPage({
  params,
  searchParams,
}: PageProps<"/boardroom/agreements/[id]">) {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const { id } = await params;
  const { signed: justSigned } = await searchParams;

  const template = await prisma.agreementTemplate.findUnique({
    where: { id },
    include: { signatures: { include: { user: { select: { name: true } } } } },
  });
  if (!template) notFound();

  const [me, members, user] = await Promise.all([
    getBoardMember(session.user.id),
    listBoardMembers(),
    prisma.user.findUnique({ where: { id: session.user.id }, select: { name: true } }),
  ]);
  const mySignature = template.signatures.find((s) => s.userId === session.user.id);
  const integrityOk = hashAgreementBody(template.body) === template.contentHash;
  const current = template.isCurrent
    ? null
    : await prisma.agreementTemplate.findFirst({ where: { code: template.code, isCurrent: true }, select: { id: true, version: true } });

  return (
    <div className="max-w-3xl space-y-6">
      <div className="print:hidden">
        <Link href="/boardroom/agreements" className="text-sm text-primary hover:underline">
          Founder agreements
        </Link>
      </div>

      {justSigned && mySignature && (
        <p className="rounded-md bg-status-success/10 px-4 py-3 text-sm text-status-success print:hidden">
          Signed. Thank you. Your signature is recorded below and in the audit log.
        </p>
      )}
      {current && (
        <p className="rounded-md bg-status-warning/10 px-4 py-3 text-sm text-status-warning print:hidden">
          This is an earlier version.{" "}
          <Link href={`/boardroom/agreements/${current.id}`} className="underline">
            Version {current.version} is current.
          </Link>
        </p>
      )}

      <article className="rounded-lg border border-border bg-surface p-5 md:p-8 print:border-0 print:p-0">
        <div className="flex flex-wrap items-start justify-between gap-3 mb-4">
          <div>
            <h1 className="text-xl font-heading font-bold">{template.title}</h1>
            <p className="text-xs text-muted-foreground mt-1">
              Version {template.version} · Published {fmtDateTime(template.publishedAt)} EAT
            </p>
          </div>
          <div className="flex gap-2 print:hidden">
            {integrityOk ? (
              <Badge tone="success"><ShieldCheck className="h-3.5 w-3.5" /> Text verified</Badge>
            ) : (
              <Badge tone="danger">Integrity check failed</Badge>
            )}
          </div>
        </div>
        <div className="whitespace-pre-wrap text-sm leading-relaxed text-justify">{template.body}</div>

        {mySignature && (
          <div className="mt-8 border-t border-border pt-5">
            <p className="text-xs uppercase tracking-wider text-muted-foreground mb-2">Signed by</p>
            {/* eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimise */}
            <img src={mySignature.signatureImage} alt={`Signature of ${mySignature.signedName}`} className="h-20 w-auto" />
            <p className="text-sm font-medium">{mySignature.signedName}</p>
            <p className="text-xs text-muted-foreground">
              {fmtDateTime(mySignature.signedAt)} EAT · IP {mySignature.ipAddress ?? "unknown"}
            </p>
            <p className="text-[11px] text-muted-foreground break-all mt-1 font-tabular">
              Text fingerprint (SHA-256) {mySignature.contentHash}
            </p>
          </div>
        )}
      </article>

      {mySignature ? (
        <div className="print:hidden">
          <PrintButton label="Print or save as PDF" />
        </div>
      ) : template.isCurrent && me ? (
        <section className="rounded-lg border border-border bg-surface p-5 print:hidden">
          <h2 className="text-sm font-semibold mb-4">Sign this agreement</h2>
          <SignAgreementForm templateId={template.id} expectedName={user?.name ?? ""} />
        </section>
      ) : null}

      <section className="rounded-lg border border-border bg-surface p-5 print:hidden">
        <h2 className="text-sm font-semibold mb-3">
          Signatures on this version ({template.signatures.length} of {members.length})
        </h2>
        <ul className="divide-y divide-border text-sm">
          {members.map((m) => {
            const s = template.signatures.find((x) => x.userId === m.userId);
            return (
              <li key={m.userId} className="flex justify-between gap-3 py-2">
                <span>{m.name}</span>
                {s ? (
                  <span className="text-status-success text-xs">Signed {fmtDateTime(s.signedAt)}</span>
                ) : (
                  <span className="text-status-warning text-xs">Not yet signed</span>
                )}
              </li>
            );
          })}
        </ul>
      </section>

      {canAdministerBoardroom(me) && template.isCurrent && (
        <div className="print:hidden">
          <Link href={`/boardroom/agreements/${template.id}/edit`} className="text-sm text-primary hover:underline">
            Publish revised wording (after legal review)
          </Link>
        </div>
      )}
    </div>
  );
}
