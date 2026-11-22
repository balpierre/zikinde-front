import { useState } from "react";
import { useQueryClient } from "@tanstack/react-query";

export interface Revue {
  /** Libellé de l’action en cours (null si aucune). */
  enCours: string | null;
  /** Message d’erreur de la dernière action (null si aucune). */
  erreur: string | null;
  /** Exécute une action de revue ; relit ensuite les résultats et le référentiel de l’artiste. */
  lancer: (libelle: string, action: () => Promise<void>) => Promise<void>;
}

/** État partagé des actions de revue (retirer / réintégrer un compte, retirer un titre). */
export function useRevue(artistId: string): Revue {
  const queryClient = useQueryClient();
  const [enCours, setEnCours] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function lancer(libelle: string, action: () => Promise<void>): Promise<void> {
    setEnCours(libelle);
    setErreur(null);
    try {
      await action();
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnCours(null);
      void queryClient.invalidateQueries({ queryKey: ["resultats", artistId] });
      void queryClient.invalidateQueries({ queryKey: ["referentiel", artistId] });
    }
  }

  return { enCours, erreur, lancer };
}
