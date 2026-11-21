import { nombre } from "./libelles";
import type { Anomaly, Node, Referentiel } from "./referentiel";

export type NiveauJauge = "bon" | "surveiller" | "faible";
export interface Jauge {
  id: "concordance" | "isrc" | "oeuvres";
  libelle: string;
  numerateur: number;
  denominateur: number;
  pourcentage: number;
  niveau: NiveauJauge;
  detail: string;
  explication: string;
}
export const niveauxJauge: Record<NiveauJauge, string> = {
  bon: "Bon",
  surveiller: "À surveiller",
  faible: "Faible",
};
export function niveauJauge(pourcentage: number): NiveauJauge {
  return pourcentage >= 80 ? "bon" : pourcentage >= 50 ? "surveiller" : "faible";
}
export function pourcentageFr(pourcentage: number): string {
  return `${nombre(pourcentage)} %`;
}
const pluriel = (n: number, singulier: string, plurielForme = `${singulier}s`) =>
  `${nombre(n)} ${n > 1 ? plurielForme : singulier}`;

export function noeudsDeType(data: Referentiel, type: string): Node[] {
  return data.nodes.filter((n) => n.type === type);
}
// Popularity follows the Deezer rank; without any rank, every recording counts.
export function enregistrementsPopulaires(data: Referentiel, limite = 20): Node[] {
  const enregistrements = noeudsDeType(data, "recording");
  const classes = enregistrements
    .filter((n) => typeof n.props["deezer_rank"] === "number")
    .sort(
      (a, b) =>
        Number(b.props["deezer_rank"]) - Number(a.props["deezer_rank"]) || a.id.localeCompare(b.id),
    );
  return classes.length ? classes.slice(0, limite) : enregistrements;
}

function jauge(
  id: Jauge["id"],
  libelle: string,
  numerateur: number,
  denominateur: number,
  detail: string,
  explication: string,
): Jauge | null {
  if (denominateur <= 0) return null;
  const pourcentage = Math.round((numerateur / denominateur) * 100);
  return {
    id,
    libelle,
    numerateur,
    denominateur,
    pourcentage,
    niveau: niveauJauge(pourcentage),
    detail,
    explication,
  };
}
// A gauge without a denominator is left out rather than shown as 0 %.
export function getGauges(data: Referentiel): Jauge[] {
  const concordants = data.matrix.filter((r) => r.status === "concordant").length;
  const compares = concordants + data.matrix.filter((r) => r.status === "divergent").length;
  const enregistrements = noeudsDeType(data, "recording");
  const avecIsrc =
    data.stats.recordings_with_isrc ??
    enregistrements.filter((n) => typeof n.props["isrc"] === "string" && n.props["isrc"]).length;
  const populaires = enregistrementsPopulaires(data);
  const classes = populaires.some((n) => typeof n.props["deezer_rank"] === "number");
  const relies = new Set(data.edges.filter((e) => e.type === "recording_of").map((e) => e.source));
  const documentes = populaires.filter((n) => relies.has(n.id)).length;
  return [
    jauge(
      "concordance",
      "Concordance des sources",
      concordants,
      compares,
      `${nombre(concordants)} champ${concordants > 1 ? "s" : ""} sur ${nombre(compares)}`,
      "Part des champs où les sources qui renseignent une valeur sont d’accord, parmi les champs concordants ou divergents de la matrice.",
    ),
    jauge(
      "isrc",
      "Couverture ISRC",
      avecIsrc,
      enregistrements.length,
      `${pluriel(avecIsrc, "enregistrement")} sur ${nombre(enregistrements.length)}`,
      "Part des enregistrements du référentiel qui portent un code ISRC.",
    ),
    jauge(
      "oeuvres",
      "Œuvres documentées",
      documentes,
      populaires.length,
      classes
        ? `${pluriel(documentes, "titre")} sur les ${nombre(populaires.length)} plus écoutés`
        : `${pluriel(documentes, "enregistrement")} sur ${nombre(populaires.length)}`,
      classes
        ? "Part des titres les plus populaires sur Deezer reliés à une œuvre (composition) dans le référentiel."
        : "Part des enregistrements reliés à une œuvre (composition) dans le référentiel.",
    ),
  ].filter((j) => j !== null);
}

export interface EnregistrementCas {
  isrc: string;
  titre: string;
  dureeS: number | null;
  sorties: string[];
  noeud?: string;
}
export interface CasIsrcDouble {
  anomalie: Anomaly;
  titre: string;
  dureeS: number | null;
  enregistrements: [EnregistrementCas, EnregistrementCas];
}
const texte = (value: unknown) => (typeof value === "string" && value.trim() ? value.trim() : null);
const listeTextes = (value: unknown) =>
  Array.isArray(value) ? value.flatMap((v) => (texte(v) ? [texte(v) as string] : [])) : [];
const duree = (value: unknown) =>
  typeof value === "number" && Number.isFinite(value) ? value : null;

// Each item compares two ISRC; the recording node, when known, gives the exact title and duration.
export function getDuplicateIsrcCases(data: Referentiel): CasIsrcDouble[] {
  const parIsrc = new Map(
    noeudsDeType(data, "recording").flatMap((n) => {
      const isrc = texte(n.props["isrc"]);
      return isrc ? [[isrc.toUpperCase(), n] as const] : [];
    }),
  );
  return data.anomalies
    .filter((a) => a.type === "isrc_double")
    .flatMap((anomalie) =>
      (anomalie.items ?? []).flatMap((item) => {
        const titre = texte(item["label"]);
        const dureeS = duree(item["duree_s"]);
        const cote = (rang: 1 | 2): EnregistrementCas | null => {
          const isrc = texte(item[`isrc_${rang}`]);
          if (!isrc) return null;
          const noeud = parIsrc.get(isrc.toUpperCase());
          return {
            isrc,
            titre: noeud?.label ?? titre ?? "Titre non renseigné",
            dureeS: duree(noeud?.props["duration_s"]) ?? dureeS,
            sorties: listeTextes(item[`sorties_${rang}`]),
            ...(noeud ? { noeud: noeud.id } : {}),
          };
        };
        const premier = cote(1);
        const second = cote(2);
        if (!premier || !second) return [];
        return [
          {
            anomalie,
            titre: titre ?? premier.titre,
            dureeS,
            enregistrements: [premier, second] as [EnregistrementCas, EnregistrementCas],
          },
        ];
      }),
    );
}
export function titresDistincts(cas: CasIsrcDouble[]): number {
  return new Set(cas.map((c) => c.titre.toLocaleLowerCase("fr-FR"))).size;
}
// Card subtitles keep the first sentence, cut on a word boundary when still too long.
export function raccourcir(text: string | undefined, max = 140): string {
  if (!text) return "";
  const phrase = text.trim().match(/^.+?[.!?](?=\s|$)/)?.[0] ?? text.trim();
  if (phrase.length <= max) return phrase;
  const coupe = phrase.slice(0, max);
  return `${coupe.slice(0, Math.max(coupe.lastIndexOf(" "), 0) || max).trimEnd()}…`;
}
