import { typesNoeuds } from "./libelles";
import type { Node, Referentiel } from "./referentiel";

export type TypeIdentifiant = "isrc" | "iswc" | "upc";
export interface Identifiant {
  type: TypeIdentifiant;
  code: "ISRC" | "ISWC" | "UPC";
  valeur: string;
}
// ISRC and ISWC ignore their usual separators; UPC and EAN compare without leading zeros.
export function detectIdentifier(query: string): Identifiant | null {
  const brut = query.trim().toUpperCase();
  const isrc = brut.replace(/[\s-]/g, "");
  if (/^[A-Z]{2}[A-Z0-9]{3}\d{7}$/.test(isrc)) return { type: "isrc", code: "ISRC", valeur: isrc };
  const iswc = brut.replace(/[\s.-]/g, "");
  if (/^T\d{10}$/.test(iswc)) return { type: "iswc", code: "ISWC", valeur: iswc };
  const upc = brut.replace(/[\s-]/g, "");
  if (/^\d{12,13}$/.test(upc))
    return { type: "upc", code: "UPC", valeur: upc.replace(/^0+/, "") || "0" };
  return null;
}
const champsParType: Record<TypeIdentifiant, { type: string; champs: string[] }> = {
  isrc: { type: "recording", champs: ["isrc"] },
  iswc: { type: "work", champs: ["iswc"] },
  upc: { type: "release", champs: ["upc", "barcode"] },
};
function valeursNoeud(node: Node, champs: string[]): string[] {
  return champs.flatMap((champ) => {
    const value = node.props[champ];
    return typeof value === "string" || typeof value === "number" ? [String(value)] : [];
  });
}

export interface CibleFiche {
  vue: "genealogie" | "graphe";
  oeuvre?: string;
  entite?: string;
}
export interface ResultatIdentifiant {
  noeud: Node;
  typeObjet: string;
  titre: string;
  artiste: string;
  cible: CibleFiche;
}
const relationsArtiste = ["performs", "main_artist_of", "appears_on", "composer_of"];
function artisteDe(data: Referentiel, node: Node): string {
  const types = new Map(data.nodes.map((n) => [n.id, n]));
  const lie = data.edges
    .filter((e) => e.target === node.id && relationsArtiste.includes(e.type))
    .map((e) => types.get(e.source))
    .find((n) => n && ["artist", "group", "person"].includes(n.type));
  return lie?.label ?? data.meta.artist_name ?? "Artiste non renseigné";
}
// Works open their genealogy when one exists; any other object is highlighted in the graph.
function cibleDe(data: Referentiel, node: Node): CibleFiche {
  if (node.type === "work" && data.genealogies.some((g) => g.id === node.id))
    return { vue: "genealogie", oeuvre: node.id };
  return { vue: "graphe", entite: node.id };
}
export function findByIdentifier(
  referentiels: Referentiel[],
  identifiant: Identifiant,
): ResultatIdentifiant[] {
  const { type, champs } = champsParType[identifiant.type];
  const normaliser = (valeur: string) => detectIdentifier(valeur)?.valeur;
  return referentiels.flatMap((data) =>
    data.nodes
      .filter(
        (n) =>
          n.type === type &&
          valeursNoeud(n, champs).some((v) => normaliser(v) === identifiant.valeur),
      )
      .map((noeud) => ({
        noeud,
        typeObjet: typesNoeuds[noeud.type] ?? "Objet",
        titre: noeud.label,
        artiste: artisteDe(data, noeud),
        cible: cibleDe(data, noeud),
      })),
  );
}
export function messageIntrouvable(identifiant: Identifiant): string {
  return `Aucun objet avec cet ${identifiant.code} dans le référentiel`;
}
