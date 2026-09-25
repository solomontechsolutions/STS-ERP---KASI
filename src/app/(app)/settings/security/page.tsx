import Link from "next/link";
import { redirect } from "next/navigation";
import { KeyRound, Trash2 } from "lucide-react";
import { auth } from "@/auth";
import { prisma } from "@/lib/prisma";
import { removePasskeyAction, renamePasskeyAction } from "@/lib/actions/passkeys";
import { fmtDateTime } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { AddPasskeyButton } from "@/components/security/AddPasskeyButton";
import { AppLockSettingsCard } from "@/components/security/AppLockSettings";
import { DevicePermissions } from "@/components/security/DevicePermissions";

function Section({ title, footer, children }: { title: string; footer?: string; children: React.ReactNode }) {
  return (
    <section>
      <h2 className="mb-2 px-1 text-[13px] font-medium uppercase tracking-wide text-muted-foreground">{title}</h2>
      <div className="rounded-lg border border-border bg-surface px-4 py-2">{children}</div>
      {footer && <p className="mt-2 px-1 text-[13px] text-muted-foreground text-justify">{footer}</p>}
    </section>
  );
}

export default async function SecurityPage() {
  const session = await auth();
  if (!session?.user) redirect("/login");
  const passkeys = await prisma.passkey.findMany({
    where: { userId: session.user.id },
    orderBy: { createdAt: "asc" },
  });

  return (
    <div className="mx-auto max-w-2xl space-y-8">
      <div>
        <h1 className="text-[28px] font-semibold tracking-tight">Security &amp; device</h1>
        <p className="text-[15px] text-muted-foreground text-justify">
          Use your phone&apos;s own security to sign in and to protect KASI when you are not using it.
        </p>
      </div>

      <Section
        title="Face ID, fingerprint and passkeys"
        footer="Your face or fingerprint never leaves your device. KASI stores only a public key that proves the device, which only you can unlock. Passkeys saved to iCloud Keychain or Google Password Manager also work on your other devices."
      >
        {passkeys.length === 0 ? (
          <div className="py-3">
            <p className="mb-3 text-[15px]">
              No device is set up yet. Set it up once, then sign in and unlock KASI with a glance or a touch.
            </p>
            <AddPasskeyButton />
          </div>
        ) : (
          <>
            <ul className="divide-y divide-border">
              {passkeys.map((p) => (
                <li key={p.id} className="flex items-start gap-3 py-3">
                  <span className="mt-0.5 grid h-9 w-9 shrink-0 place-items-center rounded-[10px] bg-primary/[0.08] text-primary">
                    <KeyRound className="h-[18px] w-[18px]" />
                  </span>
                  <form action={renamePasskeyAction.bind(null, p.id)} className="min-w-0 flex-1">
                    <input
                      name="name"
                      defaultValue={p.name}
                      aria-label="Device name"
                      className="w-full rounded-md bg-transparent text-[15px] font-medium outline-none focus:bg-background focus:px-2"
                    />
                    <span className="block text-[13px] text-muted-foreground">
                      Added {fmtDateTime(p.createdAt)}
                      {p.lastUsedAt ? `, last used ${fmtDateTime(p.lastUsedAt)}` : ", not used yet"}
                    </span>
                    <Badge tone={p.backedUp ? "info" : "neutral"} className="mt-1.5">
                      {p.backedUp ? "Synced with your other devices" : "This device only"}
                    </Badge>
                  </form>
                  <form action={removePasskeyAction.bind(null, p.id)}>
                    <button type="submit" aria-label={`Remove ${p.name}`} className="rounded-full p-2 text-muted-foreground hover:bg-status-danger/10 hover:text-status-danger">
                      <Trash2 className="h-4 w-4" />
                    </button>
                  </form>
                </li>
              ))}
            </ul>
            <div className="py-3">
              <AddPasskeyButton primary={false} />
            </div>
          </>
        )}
      </Section>

      <Section
        title="App lock"
        footer="Applies to this phone or computer only, like the lock in a banking app. Turn it on for each device you use."
      >
        <AppLockSettingsCard hasPasskey={passkeys.length > 0} />
      </Section>

      <Section
        title="Permissions on this device"
        footer="A website can only ask for a permission. To change one you blocked, use your phone's Settings: on iPhone, Settings, then Safari (or the KASI app); on Android, the site settings behind the lock icon, or long-press the KASI icon, then App info."
      >
        <DevicePermissions />
      </Section>

      <Section title="Password">
        <div className="flex items-center justify-between py-3">
          <span className="text-[15px]">Your password still works everywhere, and is the fallback if a device is lost.</span>
          <Link href="/reset-password" className="shrink-0 pl-4 text-[15px] font-medium text-primary">
            Change
          </Link>
        </div>
      </Section>
    </div>
  );
}
