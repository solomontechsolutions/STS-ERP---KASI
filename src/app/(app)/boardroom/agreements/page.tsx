import Link from "next/link";
import { redirect } from "next/navigation";
import { Check, Minus } from "lucide-react";
import { auth } from "@/auth";
import { getSignatureMatrix } from "@/lib/boardroom/agreements";
import { canAdministerBoardroom, getBoardMember } from "@/lib/boardroom/members";
import { remindUnsignedAction } from "@/lib/actions/agreements";
import { fmtDate } from "@/lib/format";
import { Badge } from "@/components/ui/badge";

export default async function AgreementsPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const [matrix, me] = await Promise.all([getSignatureMatrix(), getBoardMember(session.user.id)]);
  const isAdmin = canAdministerBoardroom(me);
  const outstanding = matrix.totalRequired - matrix.totalSigned;

  return (
    <div className="space-y-6">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="text-2xl font-heading font-bold">Founder agreements</h1>
          <p className="text-sm text-muted-foreground">
            Every director and shareholder signs each agreement. {matrix.totalSigned} of{" "}
            {matrix.totalRequired} signatures collected.
          </p>
        </div>
        {isAdmin && outstanding > 0 && (
          <form action={remindUnsignedAction}>
            <button type="submit" className="rounded-md border border-border bg-surface px-3 py-2 text-sm hover:bg-background">
              Remind everyone who has not signed
            </button>
          </form>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        {matrix.agreements.map((a) => {
          const signedByMe = a.signatures.some((s) => s.userId === session.user.id);
          return (
            <Link
              key={a.id}
              href={`/boardroom/agreements/${a.id}`}
              className="rounded-lg border border-border bg-surface p-4 hover:border-accent"
            >
              <div className="flex items-start justify-between gap-3">
                <p className="text-sm font-semibold">{a.title}</p>
                <Badge tone={signedByMe ? "success" : "warning"}>{signedByMe ? "Signed" : "Sign now"}</Badge>
              </div>
              <p className="text-sm text-muted-foreground mt-1 text-justify">{a.summary}</p>
              <p className="text-xs text-muted-foreground mt-2">
                Version {a.version}, published {fmtDate(a.publishedAt)} · {a.signatures.length} of{" "}
                {matrix.rows.length} signed
              </p>
            </Link>
          );
        })}
      </div>

      <section className="rounded-lg border border-border bg-surface p-5">
        <h2 className="text-sm font-semibold mb-3">Signature register</h2>
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-border text-left text-xs uppercase tracking-wider text-muted-foreground">
                <th className="py-2 pr-4 font-medium">Founder</th>
                {matrix.agreements.map((a) => (
                  <th key={a.id} className="py-2 px-2 font-medium text-center whitespace-nowrap">
                    {a.code.toUpperCase()}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {matrix.rows.map((r) => (
                <tr key={r.member.userId} className="border-b border-border last:border-0">
                  <td className="py-2 pr-4 whitespace-nowrap">{r.member.name}</td>
                  {r.cells.map((c) => (
                    <td key={c.agreementId} className="py-2 px-2 text-center">
                      {c.signedAt ? (
                        <span title={`Signed ${fmtDate(c.signedAt)}`} className="inline-flex items-center gap-1 text-status-success">
                          <Check className="h-4 w-4" />
                          <span className="text-xs hidden sm:inline">{fmtDate(c.signedAt)}</span>
                        </span>
                      ) : (
                        <span title="Not signed" className="inline-flex text-status-warning">
                          <Minus className="h-4 w-4" />
                          <span className="sr-only">Not signed</span>
                        </span>
                      )}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">
          LOYALTY: loyalty and fiduciary undertaking · NDA: non-disclosure · NCA: non-compete and
          non-solicitation · SECRECY: board confidentiality · CONFLICT: conflict of interest
        </p>
      </section>
    </div>
  );
}
