import { describe, it, expect } from "vitest";
import {
  bases,
  couverture,
  dateFr,
  nombre,
  statuts,
  typesNoeuds,
  typesSorties,
} from "@/lib/libelles";
import { parseReferentiel, plateformes, sourcesMatrice } from "@/lib/referentiel";

describe("Règles du référentiel", () => {
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

describe("Référentiel issu du pipeline", () => {
  it("affiche une source d’import sous son nom, sans planter hors des sources connues", () => {
    const source = { source: "import:abc", url: "", fetched_at: "2026-11-21T10:00:00+00:00" };
    const result = parseReferentiel({
      meta: {
        generated_at: "2026-11-21T10:00:00+00:00",
        query: "Artiste",
        pivot: "musicbrainz",
        match: { method: "mbid", mbid: "x", candidates: [] },
        sources: [
          {
            id: "musicbrainz",
            label: "MusicBrainz",
            url: "https://musicbrainz.org/",
            fetched_at: "",
          },
          { id: "import:abc", label: "Catalogue label 2026", url: "", fetched_at: "" },
        ],
        model: {},
        notes: [],
      },
      focus_artist: "artist:a",
      stats: { nodes_by_type: { artist: 1, recording: 1 } },
      nodes: [
        { id: "artist:a", type: "artist", label: "Artiste", props: {}, sources: [source] },
        { id: "recording:r", type: "recording", label: "Titre", props: {}, sources: [source] },
      ],
      edges: [
        {
          id: "e",
          from: "artist:a",
          to: "recording:r",
          type: "performed",
          label: "interprète",
          basis: "declared",
          rule: null,
          props: {},
          sources: [source],
        },
      ],
      claims: [{ entity: "artist:a", field: "nom", value: "Artiste", ...source }],
      matrix: [
        {
          field: "nom",
          label: "Nom",
          status: "concordant",
          values: { musicbrainz: "Artiste", "import:abc": "Artiste" },
        },
      ],
      genealogies: [],
      anomalies: [],
    });
    expect(result.state).toBe("ready");
    const data = result.data!;
    expect(data.meta.sources?.map((s) => s.name)).toEqual(["MusicBrainz", "Catalogue label 2026"]);
    expect(Object.keys(data.matrix[0]!.values)).toEqual(["MusicBrainz", "Catalogue label 2026"]);
    expect(data.nodes[1]?.sources?.[0]?.name).toBe("Catalogue label 2026");
    expect(sourcesMatrice(data)).toEqual([
      "Wikidata",
      "MusicBrainz",
      "Deezer",
      "Discogs",
      "Catalogue label 2026",
    ]);
  });
});
