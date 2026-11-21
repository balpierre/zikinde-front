import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  affirmationsGroupees,
  etatAffirmations,
  fusionnerSansLabel,
  relationsViaSorties,
  SANS_LABEL,
  selectionGraphe,
  typesParDefaut,
} from "@/lib/graphe";
import { libelleChamp, libelleRelation, proprieteFr } from "@/lib/libelles";
import { parseReferentiel, type Claim } from "@/lib/referentiel";
function reference() {
  const result = parseReferentiel(
    JSON.parse(readFileSync("src/test/fixtures-referentiel.json", "utf8")) as unknown,
  );
  if (!result.data) throw new Error("Référentiel invalide");
  return result.data;
}
describe("Graphe du catalogue", () => {
  it("sélectionne la vue lisible par défaut", () => {
    const data = reference();
    const graph = selectionGraphe(data, typesParDefaut, false);
    const nearby = data.edges
      .filter((e) => e.type === "related_to" && [e.source, e.target].includes(graph.focus))
      .map((e) => (e.source === graph.focus ? e.target : e.source));
    const ids = (type: string) =>
      new Set(graph.nodes.filter((n) => n.type === type).map((n) => n.id));
    expect(graph.focus).toBe("artist:demo");
    expect(ids("artist")).toEqual(new Set([graph.focus, ...nearby]));
    for (const type of ["work", "group", "label", "platform"])
      expect(ids(type).size).toBe(data.nodes.filter((n) => n.type === type).length);
    expect(ids("recording").size).toBe(graph.topRecordings.length);
    expect(ids("release").size + ids("person").size).toBe(0);
  });
  it("ne laisse aucun nœud isolé dans la vue par défaut", () => {
    for (const data of [reference(), fusionnerSansLabel(reference())]) {
      const graph = selectionGraphe(data, typesParDefaut, false);
      const relies = new Set(graph.edges.flatMap((e) => [e.source, e.target]));
      expect(graph.nodes.filter((n) => !relies.has(n.id)).map((n) => n.label)).toEqual([]);
    }
  });
  it("fusionne les faux labels en une absence de label explicite", () => {
    const data = reference();
    const pseudo = data.nodes.filter((n) =>
      ["[no label]", "not on label"].includes(n.label.toLowerCase()),
    );
    const fusion = fusionnerSansLabel(data);
    const ids = new Set(fusion.nodes.map((n) => n.id));
    expect(pseudo.length).toBeGreaterThan(0);
    expect(pseudo.some((n) => ids.has(n.id))).toBe(false);
    expect(fusion.nodes.filter((n) => n.id === SANS_LABEL)).toHaveLength(1);
    expect(fusion.edges.every((e) => ids.has(e.source) && ids.has(e.target))).toBe(true);
    expect(new Set(fusion.edges.map((e) => e.id)).size).toBe(fusion.edges.length);
    const releases = new Set(
      data.edges
        .filter((e) => e.type === "released_by" && pseudo.some((n) => n.id === e.target))
        .map((e) => e.source),
    );
    const sansLabel = relationsViaSorties(fusion, "artist:demo").find(
      (e) => e.target === SANS_LABEL,
    );
    expect(libelleRelation(sansLabel!.type, sansLabel!.label)).toBe("sorties sans label");
    expect(new Set(sansLabel?.via)).toEqual(
      new Set(
        [...releases].filter((r) =>
          data.edges.some((e) => e.source === "artist:demo" && e.target === r),
        ),
      ),
    );
  });
  it("relie les labels par un raccourci de relations déclarées", () => {
    const data = reference();
    const via = relationsViaSorties(data, "artist:demo");
    expect(via.length).toBeGreaterThan(0);
    for (const edge of via) {
      expect(edge.basis).toBe("declared");
      expect(edge.via?.length).toBeGreaterThan(0);
      for (const release of edge.via ?? []) {
        expect(
          data.edges.some(
            (e) => e.source === "artist:demo" && e.target === release && e.basis !== "inferred",
          ),
        ).toBe(true);
        expect(
          data.edges.some(
            (e) => e.type === "released_by" && e.source === release && e.target === edge.target,
          ),
        ).toBe(true);
      }
    }
  });
  it("garde l’artiste suivi au centre même sans le filtre artiste", () => {
    const data = reference();
    const graph = selectionGraphe(data, ["work"], false);
    expect(new Set(graph.nodes.map((n) => n.id))).toEqual(
      new Set([graph.focus, ...data.nodes.filter((n) => n.type === "work").map((n) => n.id)]),
    );
  });
  it("exclut les participations inférées du raccourci via sorties", () => {
    const data = reference();
    const [label] = relationsViaSorties(data, "artist:demo");
    const release = label!.via![0]!;
    const inferee = {
      ...data,
      edges: data.edges.map((e) =>
        e.source === "artist:demo" && e.target === release
          ? { ...e, basis: "inferred" as const }
          : e,
      ),
    };
    const apres = relationsViaSorties(inferee, "artist:demo").find(
      (e) => e.target === label!.target,
    );
    expect(apres?.via ?? []).not.toContain(release);
  });
  it("n’ajoute que les sorties reliées aux enregistrements ou personnes affichés", () => {
    const data = reference();
    const graph = selectionGraphe(data, [...typesParDefaut, "release"], false);
    const shown = new Set(
      graph.nodes.filter((n) => ["recording", "person"].includes(n.type)).map((n) => n.id),
    );
    const releases = graph.nodes.filter((n) => n.type === "release");
    expect(releases.length).toBeGreaterThan(0);
    expect(releases.length).toBeLessThan(data.nodes.filter((n) => n.type === "release").length);
    for (const release of releases)
      expect(
        data.edges.some(
          (e) =>
            (e.source === release.id && shown.has(e.target)) ||
            (e.target === release.id && shown.has(e.source)),
        ),
      ).toBe(true);
  });
  it("compte les relations inférées disponibles, même masquées", () => {
    const graph = selectionGraphe(reference(), typesParDefaut, false);
    const shown = selectionGraphe(reference(), typesParDefaut, true);
    expect(graph.inferees).toBe(shown.edges.filter((e) => e.basis === "inferred").length);
  });
  it("traduit les rôles de crédit Discogs", () => {
    const data = reference();
    // Every Discogs role in the file must have a translation, not the generic fallback.
    const nonTraduits = data.edges
      .filter((e) => e.type === "credited_on" || e.type === "scratched")
      .filter((e) => {
        const libelle = libelleRelation(e.type, e.label);
        return libelle.startsWith("crédité sur") || libelle === e.label;
      })
      .map((e) => e.label);
    expect(nonTraduits).toEqual([]);
    expect(libelleRelation("credited_on", "Photography By")).toBe("crédité sur · Photography By");
    expect(libelleRelation("performs", "interprète")).toBe("interprète");
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
    expect(selection.edges.every((e) => !e.via)).toBe(true);
  });
  it("signale seulement les affirmations réellement divergentes", () => {
    const groups = affirmationsGroupees(reference(), "artist:demo");
    expect(groups.find((g) => g.field === "ville")?.etat).toBe("divergent");
    expect(groups.find((g) => g.field === "id_apple-music")?.etat).toBe("divergent");
    expect(groups.find((g) => g.field === "pays")?.etat).toBe("concordant");
    expect(groups.find((g) => g.field === "genres")?.etat).toBe("concordant");
  });
  it("distingue écart mineur et divergence selon le champ", () => {
    // "MusicBrainz#b" is a second record of the same platform: same name, another URL.
    const claim = (value: Claim["value"], source = "Deezer"): Claim => ({
      id: `${source}:${String(value)}`,
      node_id: "recording:x",
      field: "",
      value,
      sources: [{ name: source.split("#")[0]!, source_url: `https://example.org/${source}` }],
    });
    const etat = (field: string, values: [Claim["value"], string][]) =>
      etatAffirmations(
        field,
        values.map(([v, s]) => claim(v, s)),
      );
    expect(
      etat("duree_s", [
        [266, "Deezer"],
        [266, "MusicBrainz"],
      ]),
    ).toBe("concordant");
    expect(
      etat("duree_s", [
        [266, "Deezer"],
        [268, "MusicBrainz"],
      ]),
    ).toBe("mineur");
    expect(
      etat("duree_s", [
        [266, "Deezer"],
        [269, "MusicBrainz"],
      ]),
    ).toBe("divergent");
    expect(
      etat("titre", [
        ["Interlude / Jazz Session", "Deezer"],
        ["Interlude - Jazz Session", "MusicBrainz"],
      ]),
    ).toBe("mineur");
    expect(
      etat("titre", [
        ["Over and Done", "Deezer"],
        ["Over and done", "MusicBrainz"],
      ]),
    ).toBe("mineur");
    expect(
      etat("titre", [
        ["Over and Done", "Deezer"],
        ["Over and Done (Mounika. Remix)", "MusicBrainz"],
      ]),
    ).toBe("divergent");
    expect(
      etat("isrc", [
        ["FRX201500001", "Deezer"],
        ["frx201500001", "MusicBrainz"],
      ]),
    ).toBe("divergent");
    expect(
      etat("titre", [
        ["Over and Done (Senbeï et Mounika. Remix)", "Deezer"],
        ["Over and Done (Mounika. Remix)", "Deezer"],
      ]),
    ).toBe("divergent");
    expect(
      etat("duree_s", [
        [224, "Deezer"],
        [224, "MusicBrainz#a"],
        [225, "MusicBrainz#b"],
      ]),
    ).toBe("mineur");
    expect(
      etat("titre", [
        ["Ningyo", "Deezer#a"],
        ["NINGYO", "Deezer#b"],
      ]),
    ).toBe("mineur");
    expect(
      etat("duree_s", [
        [224, "Deezer"],
        [225, "Deezer"],
      ]),
    ).toBe("divergent");
    expect(
      etat("titre", [
        ["Senbeï", "Deezer"],
        ["Senbei", "MusicBrainz"],
      ]),
    ).toBe("mineur");
    expect(
      etat("titre", [
        ["Over  and Done", "Deezer"],
        ["Over and Done", "MusicBrainz"],
      ]),
    ).toBe("mineur");
    expect(
      etat("genres", [
        [["rap", "jazz"], "Deezer"],
        [["jazz", "rap"], "Deezer"],
      ]),
    ).toBe("concordant");
  });
  it("réunit les sources des deux étapes du raccourci via sorties", () => {
    const data = reference();
    const cle = (s: { name: string; source_url: string }) => `${s.name}|${s.source_url}`;
    for (const edge of relationsViaSorties(data, "artist:demo")) {
      const attendues = data.edges
        .filter(
          (e) =>
            (e.source === "artist:demo" && edge.via!.includes(e.target)) ||
            (e.type === "released_by" && edge.via!.includes(e.source) && e.target === edge.target),
        )
        .flatMap((e) => e.sources ?? [])
        .map(cle);
      expect(new Set(edge.sources!.map(cle))).toEqual(new Set(attendues));
    }
  });
  it("garde déclarée une arête fusionnée vers les deux faux labels", () => {
    const data = reference();
    const pseudo = data.nodes.filter((n) =>
      ["[no label]", "not on label"].includes(n.label.toLowerCase()),
    );
    const release = data.nodes.find((n) => n.type === "release")!;
    const arete = (target: string, basis: "declared" | "inferred", url: string) => ({
      id: `${release.id}|released_by|${target}`,
      source: release.id,
      target,
      type: "released_by",
      label: "publiée par",
      basis,
      props: {},
      sources: [{ name: "Discogs", source_url: url }],
    });
    const fusion = fusionnerSansLabel({
      ...data,
      edges: [
        ...data.edges,
        arete(pseudo[0]!.id, "declared", "https://example.org/a"),
        arete(pseudo[1]!.id, "inferred", "https://example.org/b"),
      ],
    });
    const fusionnees = fusion.edges.filter(
      (e) => e.source === release.id && e.target === SANS_LABEL,
    );
    expect(fusionnees).toHaveLength(1);
    expect(fusionnees[0]!.basis).toBe("declared");
    expect(fusionnees[0]!.sources!.map((s) => s.source_url).sort()).toEqual([
      "https://example.org/a",
      "https://example.org/b",
    ]);
  });
  it("traduit les propriétés techniques affichées", () => {
    expect(libelleChamp("deezer_rank")).toBe("Indice de popularité Deezer");
    expect(libelleChamp("id_apple-music")).toBe("Identifiant Apple Music");
    expect(proprieteFr("duration_s", 266)).toBe("4 min 26 s");
    expect(proprieteFr("release_type", "single")).toBe("Single");
  });
});
