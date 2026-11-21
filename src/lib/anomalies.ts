import { z } from "zod";
import { libelleColonneElement, valeurElement } from "./libelles";
import type { Anomaly, Observation } from "./referentiel";

export const GRAVITES = ["haute", "moyenne", "faible", "info"] as const;
export const DESTINATAIRES = [
  "interne",
  "distributeur",
  "musicbrainz",
  "wikidata",
  "discogs",
] as const;
export type Destinataire = (typeof DESTINATAIRES)[number];
export const ETATS_LOCAUX = ["a_traiter", "valeur_choisie", "demande_preparee", "ignoree"] as const;
export type EtatLocal = (typeof ETATS_LOCAUX)[number];

const rangGravite = (severity: string | undefined) => {
  const index = GRAVITES.indexOf((severity ?? "") as (typeof GRAVITES)[number]);
  return index === -1 ? GRAVITES.length : index;
};
const estGravite = (severity: string | undefined) =>
  GRAVITES.includes((severity ?? "") as (typeof GRAVITES)[number]);
export function trierParGravite(anomalies: Anomaly[]): Anomaly[] {
  return [...anomalies].sort(
    (a, b) => rangGravite(a.severity) - rangGravite(b.severity) || a.id.localeCompare(b.id),
  );
}

// The source target is free text ("Interne label / éditeur, puis MusicBrainz"); steps keep its order.
const motsDestinataires: [Destinataire, RegExp][] = [
  ["interne", /\binterne\b/i],
  ["distributeur", /\bdistributeur\b/i],
  ["musicbrainz", /\bmusicbrainz\b/i],
  ["wikidata", /\bwikidata\b/i],
  ["discogs", /\bdiscogs\b/i],
];
export function etapesDestinataires(target: string | undefined): Destinataire[] {
  if (!target) return [];
  const etapes: Destinataire[] = [];
  for (const segment of target.split(/,?\s*puis\s+|\s*→\s*/i))
    for (const [destinataire] of motsDestinataires
      .map(([d, mot]) => [d, segment.search(mot)] as const)
      .filter(([, position]) => position !== -1)
      .sort((a, b) => a[1] - b[1]))
      if (!etapes.includes(destinataire)) etapes.push(destinataire);
  return etapes;
}

const date = z.string();
const reference = z.object({
  observation: z.number().int().nonnegative().nullable(),
  valeur: z.string().trim().min(1),
  note: z.string().trim().min(1),
  date,
});
const ignoree = z.object({ motif: z.string().trim().min(1), date });
const brouillon = z.object({
  destinataire: z.enum(DESTINATAIRES),
  valeurProposee: z.string(),
  message: z.string(),
  date,
});
export const decisionSchema = z.object({
  reference: reference.optional(),
  ignoree: ignoree.optional(),
  brouillon: brouillon.optional(),
});
export const decisionsSchema = z.record(decisionSchema);
export type Reference = z.infer<typeof reference>;
export type Ignoree = z.infer<typeof ignoree>;
export type Brouillon = z.infer<typeof brouillon>;
export type Decision = z.infer<typeof decisionSchema>;
export type Decisions = z.infer<typeof decisionsSchema>;
export const referenceSchema = reference;
export const ignoreeSchema = ignoree;

export function etatLocal(decision: Decision | undefined): EtatLocal {
  if (decision?.ignoree) return "ignoree";
  if (decision?.brouillon) return "demande_preparee";
  if (decision?.reference) return "valeur_choisie";
  return "a_traiter";
}

export interface FiltresAnomalies {
  gravites: string[];
  destinataire: Destinataire | "tous";
  type: string | "tous";
  etat: EtatLocal | "non_ignorees" | "tous";
}
export const filtresParDefaut: FiltresAnomalies = {
  gravites: [...GRAVITES],
  destinataire: "tous",
  type: "tous",
  etat: "non_ignorees",
};
export function filtrerAnomalies(
  anomalies: Anomaly[],
  filtres: FiltresAnomalies,
  decisions: Decisions,
): Anomaly[] {
  return trierParGravite(anomalies).filter((a) => {
    const etat = etatLocal(decisions[a.id]);
    return (
      (filtres.gravites.includes(a.severity ?? "") ||
        (!estGravite(a.severity) && filtres.gravites.length === GRAVITES.length)) &&
      (filtres.destinataire === "tous" ||
        etapesDestinataires(a.target).includes(filtres.destinataire)) &&
      (filtres.type === "tous" || a.type === filtres.type) &&
      (filtres.etat === "tous" ||
        (filtres.etat === "non_ignorees" ? etat !== "ignoree" : etat === filtres.etat))
    );
  });
}

export function texteObservation(observation: Observation): string {
  const { value } = observation;
  if (value == null) return "";
  return Array.isArray(value) ? value.join(", ") : String(value);
}
export interface DemandeCorrection {
  anomalie: string;
  titre: string;
  destinataire: Destinataire;
  champ: string;
  valeursActuelles: { source: string; valeur: string; lien: string }[];
  valeurProposee: string;
  message: string;
  preuves: string[];
  date: string;
}
export function brouillonInitial(
  anomaly: Anomaly,
  decision: Decision | undefined,
  now: string,
): Brouillon {
  return {
    destinataire: etapesDestinataires(anomaly.target)[0] ?? "interne",
    valeurProposee: decision?.reference?.valeur ?? "",
    message: [anomaly.description, anomaly.suggested_action, decision?.reference?.note]
      .filter(Boolean)
      .join("\n\n"),
    date: now,
  };
}
// Without global observations, the divergent values live in the concerned items.
function valeursElements(anomaly: Anomaly): DemandeCorrection["valeursActuelles"] {
  return (anomaly.items ?? []).map((item) => ({
    source: typeof item["label"] === "string" ? item["label"] : "Élément concerné",
    valeur: Object.entries(item)
      .filter(([key, value]) => !["label", "url"].includes(key) && value != null)
      .map(([key, value]) => `${libelleColonneElement(key)} : ${valeurElement(key, value)}`)
      .join(" · "),
    lien: typeof item["url"] === "string" ? item["url"] : "",
  }));
}
// Evidence links come from observations, then from concerned items, without duplicates.
export function demandeCorrection(anomaly: Anomaly, brouillon: Brouillon): DemandeCorrection {
  const observations = anomaly.observations ?? [];
  const liensElements = (anomaly.items ?? []).flatMap((item) =>
    typeof item["url"] === "string" ? [item["url"]] : [],
  );
  return {
    anomalie: anomaly.id,
    titre: anomaly.label,
    destinataire: brouillon.destinataire,
    champ: anomaly.field ?? "",
    valeursActuelles: observations.length
      ? observations.map((o) => ({
          source: o.source.name,
          valeur: texteObservation(o),
          lien: o.source.source_url,
        }))
      : valeursElements(anomaly),
    valeurProposee: brouillon.valeurProposee,
    message: brouillon.message,
    preuves: [...new Set([...observations.map((o) => o.source.source_url), ...liensElements])],
    date: brouillon.date,
  };
}
export function demandesPreparees(anomalies: Anomaly[], decisions: Decisions): DemandeCorrection[] {
  return trierParGravite(anomalies).flatMap((a) => {
    const draft = decisions[a.id]?.brouillon;
    return draft ? [demandeCorrection(a, draft)] : [];
  });
}
