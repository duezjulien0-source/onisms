import Image from "next/image";
import Link from "next/link";
import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";

export default async function Home() {
  const supabase = await createClient();
  const { data } = await supabase.auth.getClaims();

  if (data?.claims) {
    redirect("/protected");
  }

  return (
    <main className="min-h-screen flex flex-col items-center justify-center p-4 bg-background">
      <div className="max-w-md text-center space-y-6">
        <Image
          src="/oni-logo.svg"
          alt="ONI"
          width={140}
          height={140}
          className="mx-auto"
          priority
        />
        <div>
          <h1 className="text-6xl font-bold tracking-tight">ONI</h1>
          <p className="text-xs uppercase tracking-[0.4em] text-muted-foreground mt-2">
            Agency · SMS Tool
          </p>
        </div>
        <p className="text-muted-foreground text-sm max-w-xs mx-auto">
          Outil interne d&apos;agrégation de fournisseurs SMS pour réception
          fiable des codes Instagram et Threads.
        </p>
        <div className="flex gap-3 justify-center pt-2">
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
