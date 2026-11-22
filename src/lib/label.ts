/**
 * Appartenance au label client (plan 02, contrat back `zikinde/docs/plans/02-label-client.md`).
 * Tous les champs back sont optionnels : sans eux, tout est « inconnu », l’anomalie est « à traiter »
 * et le filtre reste sur « Tout ». Fonctions pures, sans accès réseau.
 */
import type { LabelProfile } from "./backend";
import { nomSource } from "./extraction-libelles";

export type StatutAppartenance = "client" | "other" | "unknown";
export type PerimetreLabel = StatutAppartenance | "all";

export const PERIMETRES: readonly { value: PerimetreLabel; label: string }[] = [
  { value: "client", label: "Mon label" },
  { value: "other", label: "Autres labels" },
  { value: "unknown", label: "Inconnu" },
  { value: "all", label: "Tout" },
];

const STATUTS: readonly string[] = ["client", "other", "unknown"];

export interface Preuve {
  kind: string;
  source?: string;
  value?: string;
}

export interface Appartenance {
  statut: StatutAppartenance;
  preuves: Preuve[];
}

export function estStatut(valeur: unknown): valeur is StatutAppartenance {
  return typeof valeur === "string" && STATUTS.includes(valeur);
}

export function estPerimetre(valeur: unknown): valeur is PerimetreLabel {
  return valeur === "all" || estStatut(valeur);
}

function lirePreuves(brut: unknown): Preuve[] {
  if (!Array.isArray(brut)) return [];
  return brut.flatMap((p): Preuve[] => {
    if (!p || typeof p !== "object") return [];
    const o = p as Record<string, unknown>;
    const kind = typeof o["kind"] === "string" ? o["kind"] : "";
    const source = typeof o["source"] === "string" ? o["source"] : "";
    const valeur = o["value"];
    const value = typeof valeur === "string" || typeof valeur === "number" ? String(valeur) : "";
    return [
      {
        kind,
        ...(source ? { source } : {}),
        ...(value ? { value } : {}),
      },
    ];
  });
}

/**
 * Lit l’appartenance d’une entité : chaîne (`props.ownership` du référentiel) ou objet
 * `{ status, evidence }` (`attributes.ownership` de `v_artist_entities`). Absent ⇒ « inconnu ».
 */
export function lireAppartenance(brut: unknown, preuvesBrutes?: unknown): Appartenance {
  if (estStatut(brut)) return { statut: brut, preuves: lirePreuves(preuvesBrutes) };
  if (brut && typeof brut === "object") {
    const o = brut as Record<string, unknown>;
    const statut = o["status"];
    return {
      statut: estStatut(statut) ? statut : "unknown",
      preuves: lirePreuves(o["evidence"] ?? preuvesBrutes),
    };
  }
  return { statut: "unknown", preuves: [] };
}

/** Périmètre d’une anomalie (`details.scope` ou `anomalies[].scope`). Absent ⇒ « client » : rien n’est masqué. */
export function scopeAnomalie(brut: unknown): StatutAppartenance {
  return estStatut(brut) ? brut : "client";
}

export function libellePreuve(preuve: Preuve): string {
  const valeur = preuve.value ?? "";
  switch (preuve.kind) {
    case "label":
      return preuve.source ? `Label ${nomSource(preuve.source)} : ${valeur}` : `Label : ${valeur}`;
    case "upc_prefix":
      return `Préfixe UPC ${valeur}`;
    case "isrc":
    case "isrc_registrant":
      return `Code ISRC ${valeur}`;
    default:
      return [preuve.kind, preuve.source, valeur].filter(Boolean).join(" · ");
  }
}

/** Le profil est « renseigné » dès qu’une liste contient au moins une valeur. */
export function profilRenseigne(profil: LabelProfile | null | undefined): boolean {
  return Boolean(
    profil && (profil.names.length || profil.upc_prefixes.length || profil.isrc_registrants.length),
  );
}

export function appartientAuPerimetre(
  statut: StatutAppartenance,
  perimetre: PerimetreLabel,
): boolean {
  return perimetre === "all" || statut === perimetre;
}

/**
 * Valeur effective : sans profil renseigné, « Tout » (aucun filtre ne peut alors départager) ;
 * avec profil, celle de l’URL, « Mon label » par défaut.
 */
export function perimetreEffectif(
  valeurUrl: PerimetreLabel | undefined,
  renseigne: boolean,
): PerimetreLabel {
  if (!renseigne) return "all";
  return valeurUrl ?? "client";
}

/** Paramètre `?perimetre=` des routes (ignoré s’il n’est pas une valeur connue). */
export function perimetreSearch(search: Record<string, unknown>): { perimetre?: PerimetreLabel } {
  const valeur = search["perimetre"];
  return estPerimetre(valeur) ? { perimetre: valeur } : {};
}

/** Saisie d’une liste : une valeur par ligne, nettoyée et dédoublonnée. */
export function listeSaisie(
  texte: string,
  normaliser: (valeur: string) => string = (v) => v,
): string[] {
  const valeurs = texte
    .split("\n")
    .map((ligne) => normaliser(ligne.trim()))
    .filter((valeur) => valeur.length > 0);
  return [...new Set(valeurs)];
}

/** Préfixe UPC : chiffres seulement, zéros de tête retirés (comme le back). */
export function normaliserPrefixeUpc(valeur: string): string {
  return valeur.replace(/\D/g, "").replace(/^0+/, "");
}

/** Code ISRC du producteur : cinq caractères majuscules, sans espace ni tiret (comme le back). */
export function normaliserCodeIsrc(valeur: string): string {
  return valeur.toUpperCase().replace(/[\s-]/g, "").slice(0, 5);
}
