import { useEffect, type ReactNode } from "react";
import { useLocation, useNavigate } from "@tanstack/react-router";
import { LoaderCircle } from "lucide-react";
import { useSession } from "@/hooks/use-session";
import { supabaseConfigured } from "@/lib/supabase";

/** Affiche le contenu seulement pour un utilisateur connecté ; sinon redirige vers /connexion. */
export function RequireAuth({ children }: { children: ReactNode }) {
  const { session, loading } = useSession();
  const navigate = useNavigate();
  const location = useLocation();
  useEffect(() => {
    if (!loading && !session && supabaseConfigured()) {
      void navigate({ to: "/connexion", search: { redirect: location.href } });
    }
  }, [loading, session, navigate, location.href]);
  if (!supabaseConfigured()) {
    return (
      <div className="data-notice" role="status">
        <span className="status-dot" />
        <div>
          <strong>Connexion au backend non configurée</strong>
          <p>Renseigner VITE_SUPABASE_PUBLISHABLE_KEY pour activer les extractions.</p>
        </div>
      </div>
    );
  }
  if (loading || !session) {
    return (
      <p className="flex items-center gap-2 text-muted-foreground" role="status">
        <LoaderCircle className="animate-spin" size={16} /> Chargement…
      </p>
    );
  }
  return <>{children}</>;
}
