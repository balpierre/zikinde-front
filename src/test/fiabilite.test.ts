import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseReferentiel, type Referentiel } from "@/lib/referentiel";
import { getGauges, niveauJauge, pourcentageFr } from "@/lib/fiabilite";

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
