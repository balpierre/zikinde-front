import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseReferentiel, type Referentiel } from "@/lib/referentiel";
import { detectIdentifier, findByIdentifier, messageIntrouvable } from "@/lib/identifiants";
import { selectionGraphe } from "@/lib/graphe";

const fichier: unknown = JSON.parse(readFileSync("public/data/referentiel_senbei.json", "utf8"));
function reference(): Referentiel {
  const result = parseReferentiel(fichier);
  if (!result.data) throw new Error(`Référentiel non chargé : ${result.state}`);
  return result.data;
}
function chercher(query: string) {
  const identifiant = detectIdentifier(query);
  if (!identifiant) throw new Error(`Identifiant non reconnu : ${query}`);
  return findByIdentifier([reference()], identifiant);
}

describe("Détection des identifiants", () => {
  it("reconnaît un ISRC en ignorant tirets, espaces et casse", () => {
    expect(detectIdentifier("FRPHC2000053")).toEqual({
      type: "isrc",
      code: "ISRC",
      valeur: "FRPHC2000053",
    });
    expect(detectIdentifier("fr-phc-20-00053")?.valeur).toBe("FRPHC2000053");
    expect(detectIdentifier("FR PHC 20 00053")?.type).toBe("isrc");
  });
  it("reconnaît un ISWC en ignorant points et tirets", () => {
    expect(detectIdentifier("T-304.546.767-8")).toEqual({
      type: "iswc",
      code: "ISWC",
      valeur: "T3045467678",
    });
  });
  it("fait correspondre UPC et EAN sans zéros en tête", () => {
    expect(detectIdentifier("036000291452")?.valeur).toBe("36000291452");
    expect(detectIdentifier("0036000291452")?.valeur).toBe("36000291452");
    expect(detectIdentifier("3663 7294 02950")?.type).toBe("upc");
  });
  it("laisse passer les noms d’artiste et les codes mal formés", () => {
    for (const query of ["Senbeï", "FRPHC200005", "T-304.546.767", "12345678901", "Over and Done"])
      expect(detectIdentifier(query)).toBeNull();
  });
});

describe("Recherche par identifiant dans le référentiel", () => {
  it("trouve l’enregistrement d’un ISRC et l’ouvre dans le graphe", () => {
    const [resultat] = chercher("FRPHC2000053");
    expect(resultat?.typeObjet).toBe("Enregistrement");
    expect(resultat?.artiste).toBe("Senbeï");
    expect(resultat?.cible).toEqual({ vue: "graphe", entite: "recording:FRPHC2000053" });
  });
  it("trouve l’œuvre d’un ISWC et ouvre sa généalogie", () => {
    const [resultat] = chercher("T-304.546.767-8");
    expect(resultat?.typeObjet).toBe("Œuvre");
    expect(resultat?.titre).toBe("Over and done");
    expect(resultat?.cible).toEqual({ vue: "genealogie", oeuvre: "work:over-and-done" });
  });
  it("trouve une sortie par son UPC ou son code-barres", () => {
    expect(chercher("3663729402950")[0]?.titre).toBe("Rêves");
    expect(chercher("3618112645940")).toHaveLength(1);
  });
  it("signale un identifiant bien formé mais introuvable", () => {
    expect(chercher("FRXXX9999999")).toEqual([]);
    const identifiant = detectIdentifier("FRXXX9999999");
    expect(identifiant && messageIntrouvable(identifiant)).toBe(
      "Aucun objet avec cet ISRC dans le référentiel",
    );
  });
  it("garde visible dans le graphe l’objet ouvert depuis la recherche", () => {
    const data = reference();
    const sortie = "release:3663729402950";
    expect(selectionGraphe(data).nodes.some((n) => n.id === sortie)).toBe(false);
    expect(selectionGraphe(data, undefined, false, sortie).nodes.some((n) => n.id === sortie)).toBe(
      true,
    );
  });
});
