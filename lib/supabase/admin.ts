import { createClient as createSupabaseClient } from "@supabase/supabase-js";

/**
 * Client Supabase ADMIN — bypass RLS, acces complet.
 * A utiliser UNIQUEMENT dans des Server Actions ou API Routes.
 * Jamais cote client.
 */
export function createAdminClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SECRET_KEY;

  if (!url || !key) {
    throw new Error(
      "Variables d'environnement manquantes : NEXT_PUBLIC_SUPABASE_URL et SUPABASE_SECRET_KEY"
    );
  }

  return createSupabaseClient(url, key, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}
