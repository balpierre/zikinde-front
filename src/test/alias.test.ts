import { readFileSync } from "node:fs";
import { describe, it, expect } from "vitest";
import { estAlias } from "@/lib/extraction-libelles";
import { parseReferentiel, variantesDeNom, type Meta } from "@/lib/referentiel";

const brut = JSON.parse(readFileSync("src/test/fixtures-referentiel.json", "utf8")) as {
  meta: Record<string, unknown>;
};

const alias = {
  link_id: 42,
  source: "musicbrainz",
  source_id: "11111111-2222-3333-4444-555555555555",
  name: "DJ Démo",
  url: "https://musicbrainz.org/artist/11111111-2222-3333-4444-555555555555",
  status: "proposed",
  reason: "autre nom déclaré par MusicBrainz (is_person)",
};

describe("Autres noms (alias)", () => {
  it("reconnaît les comptes proposés comme alias à leur méthode", () => {
    expect(estAlias("alias:musicbrainz")).toBe(true);
    expect(estAlias("alias:isrc")).toBe(true);
    expect(estAlias("declared:deezer")).toBe(false);
    expect(estAlias("user_selected")).toBe(false);
  });

  it("lit meta.aliases et meta.name_variants du référentiel", () => {
    const result = parseReferentiel({
      ...brut,
      meta: { ...brut.meta, aliases: [alias], name_variants: ["Démo", "DJ Démo"] },
    });
    expect(result.state).toBe("ready");
    expect(result.data?.meta.aliases).toEqual([alias]);
    expect(result.data?.meta.name_variants).toEqual(["Démo", "DJ Démo"]);
  });

  it("masque la section quand les champs sont absents", () => {
    const result = parseReferentiel(brut);
    expect(result.state).toBe("ready");
    expect(result.data?.meta.aliases).toBeUndefined();
    expect(result.data?.meta.name_variants).toBeUndefined();
  });

  it("ne fait pas échouer le référentiel si les alias sont mal formés", () => {
    const result = parseReferentiel({
      ...brut,
      meta: { ...brut.meta, aliases: "incorrect", name_variants: [1, 2] },
    });
    expect(result.state).toBe("ready");
    expect(result.data?.meta.aliases).toBeUndefined();
    expect(result.data?.meta.name_variants).toBeUndefined();
  });

  it("dédoublonne les variantes et retire le nom principal", () => {
    const meta: Meta = {
      artist_name: "Démo",
      name_variants: ["Démo", "DJ Démo", "dj démo", "  ", "Démo Project"],
    };
    expect(variantesDeNom(meta)).toEqual(["DJ Démo", "Démo Project"]);
  });

  it("renvoie une liste vide sans variantes", () => {
    expect(variantesDeNom({ artist_name: "Démo" })).toEqual([]);
  });
});
