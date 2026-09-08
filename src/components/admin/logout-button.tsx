import { signOut } from "@/auth";

export function LogoutButton() {
  return (
    <form
      action={async () => {
        "use server";
        await signOut({ redirectTo: "/login" });
      }}
    >
      <button
        type="submit"
        className="font-sans text-sm text-paper/60 hover:underline"
      >
        Sair
      </button>
    </form>
  );
}
