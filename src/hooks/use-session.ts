import { useEffect, useState } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase, supabaseConfigured } from "@/lib/supabase";

/** Session Supabase côté navigateur (null pendant le rendu serveur). */
export function useSession(): { session: Session | null; loading: boolean } {
  const [state, setState] = useState<{ session: Session | null; loading: boolean }>({
    session: null,
    loading: true,
  });
  useEffect(() => {
    if (!supabaseConfigured()) {
      setState({ session: null, loading: false });
      return;
    }
    const client = supabase();
    void client.auth
      .getSession()
      .then(({ data }) => setState({ session: data.session, loading: false }));
    const { data } = client.auth.onAuthStateChange((_event, session) =>
      setState({ session, loading: false }),
    );
    return () => data.subscription.unsubscribe();
  }, []);
  return state;
}
