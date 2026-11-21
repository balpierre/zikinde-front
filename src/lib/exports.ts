import type { DemandeCorrection } from "./anomalies";
import {
  bases,
  destinataires,
  libelleChamp,
  libelleRelation,
  mentionLectureSeule,
  proprieteFr,
  typesNoeuds,
} from "./libelles";
import type { Referentiel, Source } from "./referentiel";

export interface Colonne<T> {
  titre: string;
  valeur: (ligne: T) => string;
}
// Excel FR opens UTF-8 with a BOM, semicolon separators and CRLF line endings without an import wizard.
export function versCsv<T>(colonnes: Colonne<T>[], lignes: T[]): string {
  // A leading =, +, -, @ or control character would run as a formula: an apostrophe keeps it text.
  const cellule = (brute: string) => {
    const value = /^[=+\-@\t\r]/.test(brute) ? `'${brute}` : brute;
    return /[";\r\n]/.test(value) ? `"${value.replace(/"/g, '""')}"` : value;
  };
  return (
    "\uFEFF" +
    [
      colonnes.map((c) => cellule(c.titre)),
      ...lignes.map((l) => colonnes.map((c) => cellule(c.valeur(l)))),
    ]
      .map((row) => row.join(";"))
      .join("\r\n")
  );
}

const colonnesDemandes: Colonne<DemandeCorrection>[] = [
  { titre: "Anomalie", valeur: (d) => d.anomalie },
  { titre: "Titre", valeur: (d) => d.titre },
  { titre: "Destinataire", valeur: (d) => destinataires[d.destinataire] ?? d.destinataire },
  { titre: "Champ", valeur: (d) => (d.champ ? libelleChamp(d.champ) : "") },
  {
    titre: "Valeurs actuelles",
    valeur: (d) => d.valeursActuelles.map((v) => `${v.source} : ${v.valeur}`).join(" | "),
  },
  { titre: "Valeur proposée", valeur: (d) => d.valeurProposee },
  { titre: "Message", valeur: (d) => d.message },
  { titre: "Liens de preuve", valeur: (d) => d.preuves.join(" | ") },
  { titre: "Date", valeur: (d) => d.date },
];
export function demandesCsv(demandes: DemandeCorrection[]): string {
  return versCsv(colonnesDemandes, demandes);
}
export function demandesJson(demandes: DemandeCorrection[], now: string): string {
  return JSON.stringify(
    {
      genere_le: now,
      avertissement: mentionLectureSeule,
      demandes: demandes.map((d) => ({
        ...d,
        destinataire_libelle: destinataires[d.destinataire] ?? d.destinataire,
      })),
    },
    null,
    2,
  );
}

export function referentielJson(data: Referentiel, now: string): string {
  return JSON.stringify(
    {
      exporte_le: now,
      avertissement: mentionLectureSeule,
      ...data,
    },
    null,
    2,
  );
}

const provenance = <T extends { sources?: Source[] }>(): Colonne<T>[] => [
  { titre: "Sources", valeur: (l) => (l.sources ?? []).map((s) => s.name).join(" | ") },
  {
    titre: "Liens des sources",
    valeur: (l) => (l.sources ?? []).map((s) => s.source_url).join(" | "),
  },
  {
    titre: "Dates de collecte",
    valeur: (l) => (l.sources ?? []).map((s) => s.collected_at ?? "").join(" | "),
  },
];
export const typesExportables = [
  "work",
  "recording",
  "release",
  "artist",
  "group",
  "person",
  "label",
  "platform",
];
export function noeudsCsv(data: Referentiel, type: string): string {
  const nodes = data.nodes.filter((n) => n.type === type);
  const champs = [...new Set(nodes.flatMap((n) => Object.keys(n.props)))];
  // Unknown keys share a generic label, so the technical key disambiguates the header.
  const titre = (key: string) => {
    const libelle = libelleChamp(key);
    return libelle === "Propriété complémentaire" ? `${libelle} (${key})` : libelle;
  };
  return versCsv(
    [
      { titre: "Identifiant", valeur: (n) => n.id },
      { titre: "Libellé", valeur: (n) => n.label },
      { titre: "Type", valeur: (n) => typesNoeuds[n.type] ?? n.type },
      ...champs.map((key) => ({
        titre: titre(key),
        valeur: (n: (typeof nodes)[number]) =>
          n.props[key] == null ? "" : proprieteFr(key, n.props[key]),
      })),
      ...provenance<(typeof nodes)[number]>(),
    ],
    nodes,
  );
}
export function relationsCsv(data: Referentiel): string {
  const libelles = new Map(data.nodes.map((n) => [n.id, n.label]));
  return versCsv(
    [
      { titre: "Identifiant", valeur: (e) => e.id },
      { titre: "Objet source", valeur: (e) => libelles.get(e.source) ?? e.source },
      { titre: "Relation", valeur: (e) => libelleRelation(e.type, e.label) },
      { titre: "Objet cible", valeur: (e) => libelles.get(e.target) ?? e.target },
      { titre: "Base", valeur: (e) => bases[e.basis ?? "declared"] ?? "" },
      { titre: "Règle", valeur: (e) => e.rule ?? "" },
      ...provenance<(typeof data.edges)[number]>(),
    ],
    data.edges,
  );
}
export function affirmationsCsv(data: Referentiel): string {
  const libelles = new Map(data.nodes.map((n) => [n.id, n.label]));
  return versCsv(
    [
      { titre: "Objet", valeur: (c) => libelles.get(c.node_id) ?? c.node_id },
      { titre: "Identifiant de l’objet", valeur: (c) => c.node_id },
      { titre: "Champ", valeur: (c) => libelleChamp(c.field) },
      { titre: "Valeur", valeur: (c) => (c.value == null ? "" : proprieteFr(c.field, c.value)) },
      ...provenance<(typeof data.claims)[number]>(),
    ],
    data.claims,
  );
}
