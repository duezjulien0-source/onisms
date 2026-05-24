import { createClient } from "@/lib/supabase/server";
import Link from "next/link";
import { redirect } from "next/navigation";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/protected");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md text-center space-y-6">
        <h1 className="text-6xl font-bold">
          <span>Oni</span>
          <span className="text-primary">SMS</span>
        </h1>
        <p className="text-muted-foreground">
          Outil interne d&apos;agrégation de fournisseurs SMS pour réception fiable
          des codes Instagram et Threads.
        </p>
        <div className="flex gap-3 justify-center">
          <Link
            href="/auth/login"
            className="bg-primary text-primary-foreground px-6 py-3 rounded-md font-medium hover:opacity-90 transition"
          >
            Se connecter
          </Link>
          <Link
            href="/auth/sign-up"
            className="border border-border px-6 py-3 rounded-md font-medium hover:bg-muted transition"
          >
            Créer un compte
          </Link>
        </div>
      </div>
    </main>
  );
}
