import { describe, expect, it } from "vitest";
import {
  appartientAuPerimetre,
  libellePreuve,
  lireAppartenance,
  listeSaisie,
  normaliserCodeIsrc,
  normaliserPrefixeUpc,
  perimetreEffectif,
  perimetreSearch,
  profilRenseigne,
  scopeAnomalie,
} from "@/lib/label";

describe("appartenance au label", () => {
  it("lit une chaîne (référentiel) ou un objet { status, evidence } (v_artist_entities)", () => {
    expect(lireAppartenance("client").statut).toBe("client");
    const objet = lireAppartenance({
      status: "other",
      evidence: [{ kind: "label", source: "deezer", value: "Chinese Man Records" }],
    });
    expect(objet.statut).toBe("other");
    expect(objet.preuves).toEqual([
      { kind: "label", source: "deezer", value: "Chinese Man Records" },
    ]);
  });

  it("absent ou inconnu ⇒ unknown, sans preuve", () => {
    expect(lireAppartenance(undefined)).toEqual({ statut: "unknown", preuves: [] });
    expect(lireAppartenance({ status: "n'importe quoi" }).statut).toBe("unknown");
    expect(lireAppartenance(42).statut).toBe("unknown");
  });

  it("formate les preuves", () => {
    expect(libellePreuve({ kind: "label", source: "deezer", value: "Banzaï Lab" })).toBe(
      "Label Deezer : Banzaï Lab",
    );
    expect(libellePreuve({ kind: "upc_prefix", value: "3663729" })).toBe("Préfixe UPC 3663729");
    expect(libellePreuve({ kind: "isrc", value: "FRPHC" })).toBe("Code ISRC FRPHC");
  });
});

describe("périmètre et anomalies", () => {
  it("anomalie sans scope ⇒ client (rien masqué par défaut)", () => {
    expect(scopeAnomalie(undefined)).toBe("client");
    expect(scopeAnomalie("other")).toBe("other");
    expect(scopeAnomalie("bidule")).toBe("client");
  });

  it("filtre : Tout voit tout, les autres filtrent sur leur statut", () => {
    expect(appartientAuPerimetre("other", "all")).toBe(true);
    expect(appartientAuPerimetre("other", "client")).toBe(false);
    expect(appartientAuPerimetre("client", "client")).toBe(true);
    expect(appartientAuPerimetre("unknown", "unknown")).toBe(true);
  });

  it("valeur effective : URL d’abord, puis Mon label si profil, sinon Tout", () => {
    expect(perimetreEffectif(undefined, true)).toBe("client");
    expect(perimetreEffectif(undefined, false)).toBe("all");
    expect(perimetreEffectif("other", true)).toBe("other");
    expect(perimetreEffectif("all", true)).toBe("all");
    expect(perimetreEffectif("client", false)).toBe("all");
  });

  it("paramètre d’URL : seules les valeurs connues sont gardées", () => {
    expect(perimetreSearch({ perimetre: "client" })).toEqual({ perimetre: "client" });
    expect(perimetreSearch({ perimetre: "all" })).toEqual({ perimetre: "all" });
    expect(perimetreSearch({ perimetre: "label" })).toEqual({});
    expect(perimetreSearch({})).toEqual({});
  });
});

describe("profil du label", () => {
  const vide = { org_id: "o", names: [], upc_prefixes: [], isrc_registrants: [], updated_at: "" };

  it("profil vide ou absent n’est pas renseigné", () => {
    expect(profilRenseigne(null)).toBe(false);
    expect(profilRenseigne(vide)).toBe(false);
    expect(profilRenseigne({ ...vide, names: ["Banzaï Lab"] })).toBe(true);
  });

  it("normalise les préfixes UPC et les codes ISRC comme le back", () => {
    expect(normaliserPrefixeUpc("0366-3729 ")).toBe("3663729");
    expect(normaliserCodeIsrc(" fr-phc-26 ")).toBe("FRPHC");
  });

  it("saisie : une valeur par ligne, nettoyée, sans doublon ni ligne vide", () => {
    expect(listeSaisie("  Banzaï Lab \n\nBanzaï Lab\nBanzai Lab Records ")).toEqual([
      "Banzaï Lab",
      "Banzai Lab Records",
    ]);
    expect(listeSaisie("0366\n3663729", normaliserPrefixeUpc)).toEqual(["366", "3663729"]);
  });
});
