import { redirect } from "next/navigation";
import { AuthError } from "next-auth";
import { signIn } from "@/auth";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ callbackUrl?: string; error?: string }>;
}) {
  const { callbackUrl, error } = await searchParams;

  async function login(formData: FormData) {
    "use server";
    const email = formData.get("email") as string;
    const password = formData.get("password") as string;

    try {
      await signIn("credentials", {
        email,
        password,
        redirectTo: callbackUrl || "/dashboard",
      });
    } catch (err) {
      if (err instanceof AuthError) {
        redirect("/login?error=CredentialsSignin");
      }
      throw err;
    }
  }

  return (
    <main className="flex min-h-screen items-center justify-center bg-ink text-paper">
      <form
        action={login}
        className="w-full max-w-sm border border-brass/30 p-8"
      >
        <p className="font-sans text-sm tracking-wide text-brass">Backoffice</p>
        <h1 className="mt-2 font-display text-3xl">Entrar</h1>

        {error && (
          <p className="mt-4 font-sans text-sm text-rust">
            E-mail ou senha incorretos.
          </p>
        )}

        <label className="mt-6 flex flex-col gap-1 font-sans text-sm text-paper/70">
          E-mail
          <input
            type="email"
            name="email"
            required
            className="border border-brass/30 bg-transparent px-3 py-2 text-paper"
          />
        </label>

        <label className="mt-4 flex flex-col gap-1 font-sans text-sm text-paper/70">
          Senha
          <input
            type="password"
            name="password"
            required
            className="border border-brass/30 bg-transparent px-3 py-2 text-paper"
          />
        </label>

        <button
          type="submit"
          className="mt-6 w-full border border-brass bg-brass px-5 py-3 font-sans text-sm font-medium text-ink hover:opacity-90"
        >
          Entrar
        </button>
      </form>
    </main>
  );
}
