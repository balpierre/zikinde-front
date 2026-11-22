import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseReferentiel, type Referentiel } from "@/lib/referentiel";
import {
  getDivergentFields,
  getDuplicateIsrcCases,
  getGauges,
  getIcebergCounts,
  largeurIceberg,
  niveauJauge,
  pourcentageFr,
  raccourcir,
  syntheseIceberg,
  titresDistincts,
} from "@/lib/fiabilite";
import { dureeCourte } from "@/lib/libelles";

const fichier: unknown = JSON.parse(readFileSync("src/test/fixtures-referentiel.json", "utf8"));
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
  it("calcule les trois jauges de la fixture", () => {
    const jauges = getGauges(reference());
    expect(
      jauges.map((j) => [j.id, j.numerateur, j.denominateur, pourcentageFr(j.pourcentage)]),
    ).toEqual([
      ["concordance", 6, 9, "67 %"],
      ["isrc", 15, 15, "100 %"],
      ["oeuvres", 5, 15, "33 %"],
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
  it("liste les cas de la fixture dans l’ordre du fichier", () => {
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

describe("Iceberg du catalogue", () => {
  it("compte les trois couches de la fixture", () => {
    const couches = getIcebergCounts(reference());
    expect(couches.map((c) => [c.type, c.nombre, c.identifiant, c.visible])).toEqual([
      ["release", 16, "UPC", true],
      ["recording", 15, "ISRC", false],
      ["work", 3, "ISWC", false],
    ]);
    expect(couches[2]?.avecIdentifiant).toBe(2);
    expect(syntheseIceberg(couches)).toBe("3 œuvres documentées pour 15 enregistrements");
  });
  it("suit une échelle logarithmique bornée", () => {
    expect(largeurIceberg(243, 243)).toBeCloseTo(1);
    expect(largeurIceberg(0, 243)).toBe(0.24);
    const oeuvres = largeurIceberg(3, 243);
    expect(oeuvres).toBeGreaterThan(0.24 + 0.76 * (3 / 243));
    expect(oeuvres).toBeLessThan(largeurIceberg(128, 243));
  });
  it("ne produit pas de synthèse sans catalogue", () => {
    expect(syntheseIceberg(getIcebergCounts(vide()))).toBe("");
  });
});

describe("Champs divergents", () => {
  it("retient Label, Ville et Apple Music avec les observations des anomalies", () => {
    const champs = getDivergentFields(reference());
    expect(champs.map((c) => [c.field, c.anomalie?.id])).toEqual([
      ["ville", "A03"],
      ["label", "A01"],
      ["id_apple-music", "A02"],
    ]);
    const label = champs.find((c) => c.field === "label");
    expect(label?.valeurs.map((v) => `${v.source} : ${v.valeur}`)).toContain(
      "Deezer : Banzaï Lab (64/67 sorties)",
    );
    expect(label?.valeurs.every((v) => v.lien.startsWith("https://"))).toBe(true);
  });
  it("compare les valeurs de la matrice sans anomalie associée", () => {
    const data = vide();
    data.matrix = [
      {
        field: "ville",
        label: "Ville",
        status: "divergent",
        values: {
          MusicBrainz: { value: "Bordeaux", source_url: "https://mb.example" },
          Discogs: { value: "Paris" },
          Deezer: { value: null },
        },
      },
    ];
    expect(getDivergentFields(data)).toEqual([
      {
        field: "ville",
        libelle: "Ville",
        valeurs: [
          { source: "MusicBrainz", valeur: "Bordeaux", lien: "https://mb.example" },
          { source: "Discogs", valeur: "Paris", lien: "" },
        ],
      },
    ]);
  });
});
