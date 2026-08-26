import { redirect } from "next/navigation";
import bcrypt from "bcryptjs";
import { z } from "zod";
import { auth, signOut } from "@/auth";
import { prisma } from "@/lib/prisma";
import { recordAudit } from "@/lib/audit";

const schema = z
  .object({
    currentPassword: z.string().min(1, "Required"),
    newPassword: z.string().min(10, "Use at least 10 characters"),
    confirmPassword: z.string().min(1, "Required"),
  })
  .refine((data) => data.newPassword === data.confirmPassword, {
    message: "Passwords do not match",
    path: ["confirmPassword"],
  });

export default async function ResetPasswordPage({
  searchParams,
}: PageProps<"/reset-password">) {
  const session = await auth();
  if (!session?.user) redirect("/login");

  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;

  async function resetPassword(formData: FormData) {
    "use server";
    const session = await auth();
    if (!session?.user) redirect("/login");

    const parsed = schema.safeParse({
      currentPassword: formData.get("currentPassword"),
      newPassword: formData.get("newPassword"),
      confirmPassword: formData.get("confirmPassword"),
    });
    if (!parsed.success) {
      redirect(
        `/reset-password?error=${encodeURIComponent(parsed.error.issues[0]?.message ?? "Invalid input")}`,
      );
    }

    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
    });
    if (!user) redirect("/login");

    const valid = await bcrypt.compare(
      parsed.data.currentPassword,
      user.passwordHash,
    );
    if (!valid) {
      redirect(`/reset-password?error=${encodeURIComponent("Current password is incorrect")}`);
    }

    const newHash = await bcrypt.hash(parsed.data.newPassword, 12);
    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newHash, mustResetPassword: false },
    });

    await recordAudit({
      entityType: "user",
      entityId: user.id,
      action: "password_reset",
      actorId: user.id,
    });

    await signOut({ redirectTo: "/login" });
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-sm rounded-xl bg-surface p-8 shadow-lg">
        <div className="mb-6 text-center">
          <p className="font-heading text-2xl font-bold text-primary">KASI</p>
          <p className="text-sm text-muted-foreground mt-1">
            Set a new password to continue
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-md bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
            {error}
          </p>
        )}

        <form action={resetPassword} className="space-y-4">
          <div>
            <label htmlFor="currentPassword" className="block text-sm font-medium mb-1">
              Current (temporary) password
            </label>
            <input
              id="currentPassword"
              name="currentPassword"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="newPassword" className="block text-sm font-medium mb-1">
              New password
            </label>
            <input
              id="newPassword"
              name="newPassword"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label htmlFor="confirmPassword" className="block text-sm font-medium mb-1">
              Confirm new password
            </label>
            <input
              id="confirmPassword"
              name="confirmPassword"
              type="password"
              required
              minLength={10}
              autoComplete="new-password"
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Set password &amp; sign in again
          </button>
        </form>
      </div>
    </div>
  );
}
