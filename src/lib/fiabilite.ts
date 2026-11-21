import { nombre } from "./libelles";
import type { Node, Referentiel } from "./referentiel";

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
