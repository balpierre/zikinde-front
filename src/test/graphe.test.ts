import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { affirmationsGroupees, selectionGraphe, typesParDefaut } from "@/lib/graphe";
import { libelleChamp, proprieteFr } from "@/lib/libelles";
import { parseReferentiel } from "@/lib/referentiel";
function reference() {
  const result = parseReferentiel(
    JSON.parse(readFileSync("public/data/referentiel_senbei.json", "utf8")) as unknown,
  );
  if (!result.data) throw new Error("Référentiel invalide");
  return result.data;
}
describe("Graphe du catalogue", () => {
  it("sélectionne la vue lisible par défaut", () => {
    const data = reference();
    const graph = selectionGraphe(data, typesParDefaut, false);
    const count = (type: string) => graph.nodes.filter((n) => n.type === type).length;
    expect(graph.focus).toBe("artist:senbei");
    expect({
      artist: count("artist"),
      work: count("work"),
      group: count("group"),
      label: count("label"),
      platform: count("platform"),
      recording: count("recording"),
      release: count("release"),
      person: count("person"),
    }).toEqual({
      artist: 21,
      work: 3,
      group: 4,
      label: 18,
      platform: 19,
      recording: 20,
      release: 0,
      person: 0,
    });
  });
  it("retient les 20 enregistrements au plus fort indice Deezer", () => {
    const data = reference();
    const ranks = data.nodes
      .filter((n) => n.type === "recording" && typeof n.props["deezer_rank"] === "number")
      .map((n) => Number(n.props["deezer_rank"]))
      .sort((a, b) => b - a);
    const selected = selectionGraphe(data).topRecordings.map((n) => Number(n.props["deezer_rank"]));
    expect(selected).toEqual(ranks.slice(0, 20));
    expect(selected[0]).toBe(Math.max(...ranks));
  });
  it("masque les relations inférées sauf demande explicite", () => {
    const data = reference();
    const selection = selectionGraphe(data, [...typesParDefaut], false);
    expect(selection.edges.some((e) => e.basis === "inferred")).toBe(false);
    const withInference = selectionGraphe(data, [...typesParDefaut], true);
    expect(withInference.edges.some((e) => e.basis === "inferred")).toBe(true);
  });
  it("filtre les types de nœuds demandés", () => {
    const selection = selectionGraphe(reference(), ["artist", "person"], false);
    expect(new Set(selection.nodes.map((n) => n.type))).toEqual(new Set(["artist", "person"]));
  });
  it("signale seulement les affirmations réellement divergentes", () => {
    const groups = affirmationsGroupees(reference(), "artist:senbei");
    expect(groups.find((g) => g.field === "ville")?.divergent).toBe(true);
    expect(groups.find((g) => g.field === "id_apple-music")?.divergent).toBe(true);
    expect(groups.find((g) => g.field === "pays")?.divergent).toBe(false);
    expect(groups.find((g) => g.field === "genres")?.divergent).toBe(false);
  });
  it("traduit les propriétés techniques affichées", () => {
    expect(libelleChamp("deezer_rank")).toBe("Indice de popularité Deezer");
    expect(libelleChamp("id_apple-music")).toBe("Identifiant Apple Music");
    expect(proprieteFr("duration_s", 266)).toBe("4 min 26 s");
    expect(proprieteFr("release_type", "single")).toBe("Single");
  });
});
