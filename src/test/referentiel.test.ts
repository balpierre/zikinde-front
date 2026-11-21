import { describe, it, expect } from "vitest";
import {
  bases,
  correspondSenbei,
  couverture,
  dateFr,
  nombre,
  statuts,
  typesNoeuds,
  typesSorties,
} from "@/lib/libelles";
import { parseReferentiel, plateformes } from "@/lib/referentiel";

describe("Règles du référentiel", () => {
  it("propose Senbeï pour senb et ne propose aucun autre artiste", () => {
    expect(correspondSenbei("senb")).toBe(true);
    expect(correspondSenbei("Senbeï")).toBe(true);
    expect(correspondSenbei("autre artiste")).toBe(false);
    expect(correspondSenbei("")).toBe(false);
  });
  it("formate les milliers avec un espace français", () => {
    expect(nombre(23394)).toBe("23 394");
  });
  it("formate les dates en français", () => {
    expect(dateFr("2025-11-14")).toBe("14 novembre 2025");
  });
  it("distingue les trois types du catalogue", () => {
    expect(typesNoeuds["work"]).toBe("Œuvre");
    expect(typesNoeuds["recording"]).toBe("Enregistrement");
    expect(typesNoeuds["release"]).toBe("Sortie");
  });
  it("traduit les bases, types de sortie et statuts", () => {
    expect(bases["inferred"]).toBe("inférée");
    expect(typesSorties["album"]).toBe("Album");
    expect(statuts["source_unique"]).toBe("Source unique");
  });
  it("calcule la couverture des identifiants sans fabriquer une couverture absente", () => {
    expect(couverture(3, 4)).toBe("75 %");
    expect(couverture(undefined, undefined)).toBe("—");
    expect(couverture(0, 0)).toBe("—");
  });
  it("refuse un référentiel mal formé", () => {
    expect(parseReferentiel({ stats: "incorrect" }).state).toBe("invalid");
  });
  it("lit la catégorie du nœud et le lien de la relation", () => {
    const result = parseReferentiel({
      meta: {},
      stats: {},
      matrix: [],
      genealogies: [],
      anomalies: [],
      claims: [],
      nodes: [
        { id: "deezer", type: "platform", label: "Deezer", props: { category: "streaming" } },
      ],
      edges: [
        {
          id: "e",
          source: "senbei",
          target: "deezer",
          type: "available_on",
          label: "Disponible sur",
          props: { url: "https://www.deezer.com/" },
          basis: "inferred",
          rule: "Identifiant concordant",
        },
      ],
    });
    expect(result.state).toBe("ready");
    const platform = plateformes(result.data)[0];
    expect(platform?.category).toBe("streaming");
    expect(platform?.url).toBe("https://www.deezer.com/");
    expect(platform?.edge.label).toBe("Disponible sur");
  });
});
