import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseReferentiel, type Referentiel } from "@/lib/referentiel";
import {
  getDuplicateIsrcCases,
  getGauges,
  niveauJauge,
  pourcentageFr,
  raccourcir,
  titresDistincts,
} from "@/lib/fiabilite";
import { dureeCourte } from "@/lib/libelles";

const fichier: unknown = JSON.parse(readFileSync("public/data/referentiel_senbei.json", "utf8"));
function reference(): Referentiel {
  const result = parseReferentiel(fichier);
  if (!result.data) throw new Error(`Référentiel non chargé : ${result.state}`);
  return result.data;
}
const vide = (): Referentiel => ({
  meta: {},
  stats: {},
  matrix: [],
  genealogies: [],
  anomalies: [],
  nodes: [],
  edges: [],
  claims: [],
});

describe("Jauges de fiabilité", () => {
  it("calcule les trois jauges de Senbeï", () => {
    const jauges = getGauges(reference());
    expect(
      jauges.map((j) => [j.id, j.numerateur, j.denominateur, pourcentageFr(j.pourcentage)]),
    ).toEqual([
      ["concordance", 6, 9, "67 %"],
      ["isrc", 214, 243, "88 %"],
      ["oeuvres", 3, 20, "15 %"],
    ]);
    expect(jauges.map((j) => j.niveau)).toEqual(["surveiller", "bon", "faible"]);
    expect(jauges[0]?.detail).toBe("6 champs sur 9");
  });
  it("applique les seuils 80 % et 50 %", () => {
    expect(niveauJauge(80)).toBe("bon");
    expect(niveauJauge(79)).toBe("surveiller");
    expect(niveauJauge(50)).toBe("surveiller");
    expect(niveauJauge(49)).toBe("faible");
  });
  it("prend tous les enregistrements sans rang Deezer", () => {
    const data = vide();
    data.nodes = [
      { id: "r1", type: "recording", label: "A", props: {} },
      { id: "r2", type: "recording", label: "B", props: {} },
      { id: "w1", type: "work", label: "A", props: {} },
    ];
    data.edges = [
      { id: "e", source: "r1", target: "w1", type: "recording_of", label: "", props: {} },
    ];
    const oeuvres = getGauges(data).find((j) => j.id === "oeuvres");
    expect([oeuvres?.numerateur, oeuvres?.denominateur]).toEqual([1, 2]);
  });
  it("n’affiche aucune jauge sans données", () => {
    expect(getGauges(vide())).toEqual([]);
  });
});

describe("Cas d’ISRC en double", () => {
  it("liste les cas de Senbeï dans l’ordre du fichier", () => {
    const cas = getDuplicateIsrcCases(reference());
    expect(cas).toHaveLength(5);
    expect(titresDistincts(cas)).toBe(3);
    const [premier] = cas;
    expect(premier?.titre).toBe("Over and Done");
    expect(premier?.enregistrements.map((e) => [e.isrc, e.sorties])).toEqual([
      ["FRPHC2000053", ["Over and Done (Remix)", "Play Dead", "Play Dead (XTND)"]],
      ["FRPHC2000007", ["Reset"]],
    ]);
    expect(dureeCourte(premier?.dureeS)).toBe("4 min 26");
  });
  it("ignore un élément incomplet et l’absence d’anomalie", () => {
    const data = vide();
    expect(getDuplicateIsrcCases(data)).toEqual([]);
    data.anomalies = [
      { id: "a", label: "", status: "ouverte", type: "isrc_double", items: [{ isrc_1: "X" }] },
    ];
    expect(getDuplicateIsrcCases(data)).toEqual([]);
  });
  it("raccourcit la description à sa première phrase", () => {
    expect(raccourcir("Même titre, même durée. Suite longue.")).toBe("Même titre, même durée.");
    expect(raccourcir("mot ".repeat(60), 20)).toBe("mot mot mot mot mot…");
  });
});
