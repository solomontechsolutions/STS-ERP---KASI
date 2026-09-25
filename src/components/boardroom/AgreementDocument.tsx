import { fmtDateTime } from "@/lib/format";

type Signature = {
  signedName: string;
  signatureImage: string;
  signedAt: Date;
  ipAddress: string | null;
  contentHash: string;
};

type Block =
  | { kind: "title"; text: string }
  | { kind: "heading"; text: string }
  | { kind: "clause"; num: string; text: string }
  | { kind: "sub"; num: string; text: string }
  | { kind: "item"; label: string; text: string }
  | { kind: "party"; label: string; text: string }
  | { kind: "para"; text: string };

/** Reads the plain-text layout described in agreement-templates.ts. */
export function parseAgreement(body: string): Block[] {
  const lines = body.split("\n").map((l) => l.trim()).filter(Boolean);
  return lines.map((line, i): Block => {
    if (i === 0) return { kind: "title", text: line };
    let m = line.match(/^(\d+)\.\s+([^a-z]+)$/);
    if (m) return { kind: "clause", num: `${m[1]}.`, text: m[2] };
    m = line.match(/^(\d+\.\d+)\s+(.*)$/);
    if (m) return { kind: "sub", num: m[1], text: m[2] };
    m = line.match(/^\(([a-z]{1,4})\)\s+(.*)$/);
    if (m) return { kind: "item", label: `(${m[1]})`, text: m[2] };
    m = line.match(/^\(([A-Z]|\d+)\)\s+(.*)$/);
    if (m) return { kind: "party", label: `(${m[1]})`, text: m[2] };
    if (/^[A-Z][A-Z\s,&'’()-]+$/.test(line)) return { kind: "heading", text: line };
    return { kind: "para", text: line };
  });
}

/** Bolds a leading run of capitals, e.g. "THIS AGREEMENT", "IT IS AGREED". */
function Lead({ text }: { text: string }) {
  const m = text.match(/^([A-Z][A-Z]+(?: [A-Z]{2,})+)(\b.*)$/);
  if (!m) return <>{text}</>;
  return (
    <>
      <strong>{m[1]}</strong>
      {m[2]}
    </>
  );
}

/**
 * An agreement laid out as a formal legal document: Times New Roman, 12pt
 * body and 11pt notes, justified, numbered clauses with hanging indents,
 * and an execution block. Prints on A4 (see .legal-doc in globals.css).
 */
export function AgreementDocument({
  body,
  version,
  signature,
}: {
  body: string;
  version: number;
  signature?: Signature | null;
}) {
  const blocks = parseAgreement(body);
  return (
    <div className="legal-doc">
      {blocks.map((b, i) => {
        switch (b.kind) {
          case "title":
            return (
              <h1 key={i} className="legal-title">
                {b.text}
              </h1>
            );
          case "heading":
            return (
              <h2 key={i} className="legal-heading">
                {b.text}
              </h2>
            );
          case "clause":
            return (
              <h3 key={i} className="legal-clause">
                <span className="legal-num">{b.num}</span>
                <span>{b.text}</span>
              </h3>
            );
          case "sub":
            return (
              <p key={i} className="legal-row">
                <span className="legal-num">{b.num}</span>
                <span>{b.text}</span>
              </p>
            );
          case "item":
            return (
              <p key={i} className="legal-row legal-item">
                <span className="legal-num">{b.label}</span>
                <span>{b.text}</span>
              </p>
            );
          case "party":
            return (
              <p key={i} className="legal-row">
                <span className="legal-num">{b.label}</span>
                <span>
                  <Lead text={b.text} />
                </span>
              </p>
            );
          default:
            return (
              <p key={i} className="legal-para">
                <Lead text={b.text} />
              </p>
            );
        }
      })}

      <h2 className="legal-heading legal-execution">EXECUTION</h2>
      <p className="legal-para">
        SIGNED electronically by the Founder through the KASI system of the Company.
      </p>
      <div className="legal-sign">
        <div>
          <p className="legal-label">Signature</p>
          <div className="legal-sign-box">
            {signature && (
              // eslint-disable-next-line @next/next/no-img-element -- data URL, nothing to optimise
              <img src={signature.signatureImage} alt={`Signature of ${signature.signedName}`} />
            )}
          </div>
        </div>
        <div>
          <p className="legal-label">Full name</p>
          <p className="legal-line">{signature?.signedName ?? ""}</p>
          <p className="legal-label">Date and time</p>
          <p className="legal-line">{signature ? `${fmtDateTime(signature.signedAt)} EAT` : ""}</p>
        </div>
      </div>
      <p className="legal-note">
        Version {version}.
        {signature && ` Electronic signature recorded from IP address ${signature.ipAddress ?? "not available"}.`}
      </p>
      {signature && (
        <p className="legal-note legal-hash">
          SHA-256 fingerprint of the signed text: {signature.contentHash}
        </p>
      )}
    </div>
  );
}
