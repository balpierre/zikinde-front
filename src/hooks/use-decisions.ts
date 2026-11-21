import { useCallback, useEffect, useState } from "react";
import { decisionSchema, type Decision, type Decisions } from "@/lib/anomalies";

const cle = (artiste: string) => `zikinde:decisions:v1:${artiste}`;
// Entries are validated one by one so a single corrupt decision does not erase the others.
function lire(artiste: string): { decisions: Decisions; persistant: boolean } {
  try {
    const brut = window.localStorage.getItem(cle(artiste));
    const parsed: unknown = brut ? JSON.parse(brut) : {};
    const decisions: Decisions = {};
    if (parsed && typeof parsed === "object")
      for (const [id, value] of Object.entries(parsed)) {
        const decision = decisionSchema.safeParse(value);
        if (decision.success) decisions[id] = decision.data;
      }
    return { decisions, persistant: true };
  } catch (error) {
    return { decisions: {}, persistant: error instanceof SyntaxError };
  }
}
function ecrire(artiste: string, decisions: Decisions): boolean {
  try {
    window.localStorage.setItem(cle(artiste), JSON.stringify(decisions));
    return true;
  } catch {
    return false;
  }
}

// Decisions load after mount so server and first client render match; storage failures keep memory state.
export function useDecisions(artiste: string) {
  const [decisions, setDecisions] = useState<Decisions>({});
  const [persistant, setPersistant] = useState(true);
  useEffect(() => {
    const charger = () => {
      const lu = lire(artiste);
      setDecisions(lu.decisions);
      setPersistant(lu.persistant);
    };
    charger();
    // Another tab of the same artist page may write decisions too.
    const onStorage = (event: StorageEvent) => {
      if (event.key === cle(artiste)) charger();
    };
    window.addEventListener("storage", onStorage);
    return () => window.removeEventListener("storage", onStorage);
  }, [artiste]);
  const modifier = useCallback(
    (id: string, change: (decision: Decision) => Decision) => {
      const next = { ...decisions, [id]: change(decisions[id] ?? {}) };
      setDecisions(next);
      setPersistant(ecrire(artiste, next));
    },
    [artiste, decisions],
  );
  return { decisions, modifier, persistant };
}
