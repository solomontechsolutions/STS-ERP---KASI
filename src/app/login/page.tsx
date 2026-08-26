import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export default async function LoginPage({
  searchParams,
}: PageProps<"/login">) {
  const params = await searchParams;
  const error = typeof params.error === "string" ? params.error : undefined;
  const callbackUrl =
    typeof params.callbackUrl === "string" ? params.callbackUrl : "/";

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

  return (
    <div className="min-h-screen flex items-center justify-center bg-sidebar px-4">
      <div className="w-full max-w-sm rounded-xl bg-surface p-8 shadow-lg">
        <div className="mb-6 text-center">
          <p className="font-heading text-2xl font-bold text-primary">KASI</p>
          <p className="text-sm text-muted-foreground mt-1">
            Solomon Tech Solutions — internal system
          </p>
        </div>

        {error && (
          <p className="mb-4 rounded-md bg-status-danger/10 px-3 py-2 text-sm text-status-danger">
            Invalid email or password.
          </p>
        )}

        <form action={authenticate} className="space-y-4">
          <input type="hidden" name="callbackUrl" value={callbackUrl} />
          <div>
            <label
              htmlFor="email"
              className="block text-sm font-medium mb-1"
            >
              Email
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              autoComplete="email"
              placeholder="name@solomontechsolutions.com"
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <div>
            <label
              htmlFor="password"
              className="block text-sm font-medium mb-1"
            >
              Password
            </label>
            <input
              id="password"
              name="password"
              type="password"
              required
              autoComplete="current-password"
              className="w-full rounded-md border border-border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-accent"
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-md bg-primary px-3 py-2 text-sm font-medium text-primary-foreground hover:opacity-90 transition-opacity"
          >
            Sign in
          </button>
        </form>
      </div>
    </div>
  );
}
