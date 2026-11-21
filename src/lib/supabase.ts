import { createClient, type SupabaseClient } from "@supabase/supabase-js";

// Valeurs PUBLIQUES (URL du projet + clé anon/publishable) : la sécurité repose sur la RLS côté base.
// Surchargeables par VITE_SUPABASE_URL / VITE_SUPABASE_PUBLISHABLE_KEY. Ne jamais mettre ici la clé service_role.
const env = import.meta.env as Record<string, string | undefined>;
const SUPABASE_URL: string = env["VITE_SUPABASE_URL"] ?? "https://lqqueunulkuknknjwrcf.supabase.co";
const SUPABASE_KEY: string = env["VITE_SUPABASE_PUBLISHABLE_KEY"] ?? "";

let client: SupabaseClient | undefined;

export function supabaseConfigured(): boolean {
  return Boolean(SUPABASE_URL && SUPABASE_KEY);
}

/** Client navigateur uniquement (session stockée dans le navigateur). Les pages qui l'utilisent sont en `ssr: false`. */
export function supabase(): SupabaseClient {
  if (typeof window === "undefined") {
    throw new Error("Le client Supabase n’est disponible que dans le navigateur.");
  }
  if (!supabaseConfigured()) {
    throw new Error("Configuration Supabase manquante (VITE_SUPABASE_PUBLISHABLE_KEY).");
  }
  client ??= createClient(SUPABASE_URL, SUPABASE_KEY, {
    auth: { persistSession: true, autoRefreshToken: true, detectSessionInUrl: true },
  });
  return client;
}
