import { useQuery } from "@tanstack/react-query";
import { getAppartenances, getLabelProfile, type LabelProfile } from "@/lib/backend";
import { perimetreEffectif, profilRenseigne, type PerimetreLabel } from "@/lib/label";

/** État du filtre « Mon label » d’une page : profil, périmètre courant (URL) et appartenances. */
export interface EtatLabel {
  /** Profil du label, null si non renseigné (ou backend pas encore déployé). */
  profil: LabelProfile | null;
  renseigne: boolean;
  perimetre: PerimetreLabel;
  changer: (perimetre: PerimetreLabel) => void;
  /** Appartenances brutes par `entity_type|source|source_id` ; vide si non chargées. */
  appartenances: Record<string, unknown>;
}

/**
 * Profil et périmètre du label. Le périmètre vient de l’URL (`?perimetre=`) ; sans paramètre, « Mon label »
 * si un profil existe, sinon « Tout ». Une erreur de lecture (back non déployé) vaut « pas de profil ».
 */
export function usePerimetreLabel({
  orgId,
  artistId,
  valeurUrl,
  changer,
}: {
  orgId: string | undefined;
  artistId?: string;
  valeurUrl: PerimetreLabel | undefined;
  changer: (perimetre: PerimetreLabel) => void;
}): EtatLabel {
  const profil = useQuery({
    queryKey: ["label-profil", orgId],
    queryFn: () => getLabelProfile(orgId ?? ""),
    enabled: Boolean(orgId),
    retry: false,
  });
  const appartenances = useQuery({
    queryKey: ["appartenances", artistId],
    queryFn: () => getAppartenances(artistId ?? ""),
    enabled: Boolean(artistId),
    retry: false,
  });
  const profilLu = profil.data ?? null;
  const renseigne = profilRenseigne(profilLu);
  return {
    profil: profilLu,
    renseigne,
    perimetre: perimetreEffectif(valeurUrl, renseigne),
    changer,
    appartenances: appartenances.data ?? {},
  };
}
