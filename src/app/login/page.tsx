import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { Lock } from "lucide-react";
import { signIn } from "@/auth";
import { PasskeySignInButton } from "@/components/auth/PasskeySignInButton";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const callbackUrl =
    typeof params.callbackUrl === "string" && params.callbackUrl.startsWith("/") && !params.callbackUrl.startsWith("//")
      ? params.callbackUrl
      : "/";

  async function authenticate(formData: FormData) {
    "use server";
    const email = String(formData.get("email") ?? "");
    const password = String(formData.get("password") ?? "");
    const redirectTo = String(formData.get("callbackUrl") ?? "/");

    try {
      await signIn("credentials", { email, password, redirectTo });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect(
          `/login?error=1&callbackUrl=${encodeURIComponent(redirectTo)}`,
        );
      }
      throw err;
    }
  }

  const field =
    "w-full rounded-xl border border-border bg-white px-4 py-3 text-[15px] outline-none transition focus:border-accent focus:ring-4 focus:ring-accent/20";

  return (
    <div className="relative min-h-screen overflow-hidden bg-[#07162b] px-4 py-10 flex items-center justify-center">
      {/* Soft light behind the card: navy to STS cyan, nothing louder. */}
      <div
        aria-hidden
        className="pointer-events-none absolute inset-0"
        style={{
          background:
            "radial-gradient(60% 50% at 20% 10%, rgba(79,182,217,0.28), transparent 70%), radial-gradient(50% 45% at 90% 90%, rgba(30,122,140,0.30), transparent 70%), linear-gradient(180deg, #0f2647 0%, #07162b 100%)",
        }}
      />

      <div className="relative w-full max-w-[400px] animate-[kasi-fade_0.4s_ease-out]">
        <div className="mb-8 text-center text-white">
          {/* eslint-disable-next-line @next/next/no-img-element -- static app icon */}
          <img
            src="/icons/icon-192.png"
            alt=""
            className="mx-auto mb-4 h-16 w-16 rounded-[1.1rem] shadow-[0_10px_30px_rgba(0,0,0,0.35)] ring-1 ring-white/15"
          />
          <h1 className="text-[28px] font-semibold tracking-tight">Welcome to KASI</h1>
          <p className="mt-1 text-[15px] text-white/65">Solomon Tech Solutions</p>
        </div>

        <div className="rounded-[1.75rem] border border-white/50 bg-white/[0.94] p-6 shadow-[0_30px_80px_rgba(0,0,0,0.35)] backdrop-blur-2xl sm:p-7">
          <PasskeySignInButton callbackUrl={callbackUrl} />

          <div className="my-5 flex items-center gap-3 text-[12px] uppercase tracking-wider text-muted-foreground">
            <span className="h-px flex-1 bg-border" /> or use your password <span className="h-px flex-1 bg-border" />
          </div>

          {error && (
            <p className="mb-4 rounded-xl bg-status-danger/10 px-3 py-2 text-[13px] text-status-danger">
              Invalid email or password.
            </p>
          )}

          <form action={authenticate} className="space-y-3">
            <input type="hidden" name="callbackUrl" value={callbackUrl} />
            <label className="block">
              <span className="sr-only">Email</span>
              <input
                id="email"
                name="email"
                type="email"
                required
                autoComplete="username webauthn"
                placeholder="name@solomontechsolutions.com"
                className={field}
              />
            </label>
            <label className="block">
              <span className="sr-only">Password</span>
              <input
                id="password"
                name="password"
                type="password"
                required
                autoComplete="current-password"
                placeholder="Password"
                className={field}
              />
            </label>
            <button
              type="submit"
              className="w-full rounded-2xl bg-primary py-3.5 text-[15px] font-semibold text-primary-foreground transition hover:opacity-95 active:scale-[0.99]"
            >
              Sign in
            </button>
          </form>
        </div>

        <p className="mt-6 flex items-center justify-center gap-1.5 text-[12px] text-white/50">
          <Lock className="h-3.5 w-3.5" /> Private system for STS directors and staff
        </p>
      </div>
    </div>
  );
}
