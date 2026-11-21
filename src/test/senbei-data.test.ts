import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { parseReferentiel, plateformes, sourceInfo, sourcesCatalogue } from "@/lib/referentiel";
import { couverture, categories } from "@/lib/libelles";

const fichier: unknown = JSON.parse(readFileSync("public/data/referentiel_senbei.json", "utf8"));
function reference() {
  const result = parseReferentiel(fichier);
  if (!result.data) throw new Error(`Référentiel non chargé : ${result.state}`);
  return result.data;
}
describe("Données Senbeï fournies", () => {
  it("charge les chiffres exacts du catalogue fourni", () => {
    const data = reference();
    expect(data.meta.artist_name).toBe("Senbeï");
    expect(data.stats).toEqual({
      works: 3,
      recordings: 243,
      releases: 128,
      anomalies: 13,
      works_with_iswc: 2,
      recordings_with_isrc: 214,
    });
  });
  it("calcule la couverture ISWC et ISRC sur les totaux fournis", () => {
    const data = reference();
    expect(couverture(data.stats.works_with_iswc, data.stats.works)).toBe("67 %");
    expect(couverture(data.stats.recordings_with_isrc, data.stats.recordings)).toBe("88 %");
  });
  it("conserve la source et la date de chaque valeur de la matrice", () => {
    const data = reference();
    expect(data.matrix).toHaveLength(9);
    const cell = data.matrix.find((r) => r.field === "pays")?.values.MusicBrainz;
    expect(cell?.value).toBe("France");
    expect(cell?.sources?.[0]?.source_url).toBe(
      "https://musicbrainz.org/artist/8cd9e97b-bb39-4f68-8630-0c8a8e91c9e0",
    );
    expect(cell?.sources?.[0]?.collected_at).toBe("2026-11-20T18:39:39+00:00");
  });
  it("calcule les contributions de chaque source à partir des nœuds", () => {
    const data = reference();
    expect(sourceInfo(data, "Wikidata")?.count).toBe(22);
    expect(sourceInfo(data, "MusicBrainz")?.count).toBe(233);
    expect(sourceInfo(data, "Deezer")?.count).toBe(301);
    expect(sourceInfo(data, "Discogs")?.count).toBe(96);
  });
  it("conserve les généalogies et les inférences", () => {
    const data = reference();
    expect(data.genealogies).toHaveLength(3);
    const relation = data.edges.find(
      (e) => e.source === "recording:FRPHC2000053" && e.target === "work:over-and-done",
    );
    expect(relation?.basis).toBe("inferred");
    expect(relation?.rule).toBe("titre normalisé identique (hors mentions remix/edit/live)");
    expect(relation?.label).toBe("enregistrement de");
    expect(data.claims).toHaveLength(1460);
    expect(data.anomalies.filter((a) => a.status === "ouverte")).toHaveLength(13);
  });
  it("utilise les liens des relations et les catégories françaises du fichier", () => {
    const items = plateformes(reference());
    const spotify = items.find((p) => p.node.label === "Spotify");
    expect(spotify?.url).toBe("https://open.spotify.com/artist/7abaqPX14i31AxrQ3lFQgv");
    expect(categories[spotify?.category ?? ""]).toBe("Écoute");
    expect(new Set(items.map((p) => categories[p.category]))).toEqual(
      new Set(["Écoute", "Vente", "Référentiel", "Réseau social", "Audience"]),
    );
  });
  it("rattache les chiffres aux sources du catalogue, pas aux seules sources d’identité", () => {
    expect(
      sourcesCatalogue(reference(), "recording")
        .map((s) => s.name)
        .sort(),
    ).toEqual(["Deezer", "MusicBrainz"]);
    expect(
      sourcesCatalogue(reference(), "work")
        .map((s) => s.name)
        .sort(),
    ).toEqual(["MusicBrainz", "Wikidata"]);
  });
});
