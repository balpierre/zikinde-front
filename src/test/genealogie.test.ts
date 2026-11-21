import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import {
  anomaliesEnregistrement,
  genealogieProjection,
  oeuvreSelectionnee,
} from "@/lib/genealogie";
import { parseReferentiel } from "@/lib/referentiel";
import { droits } from "@/lib/libelles";
function reference() {
  const input: unknown = JSON.parse(readFileSync("src/test/fixtures-referentiel.json", "utf8"));
  const result = parseReferentiel(input);
  if (!result.data) throw new Error("Référentiel invalide");
  return result.data;
}
describe("Généalogie du catalogue", () => {
  it("sélectionne Over and done par défaut", () => {
    expect(oeuvreSelectionnee(reference())?.id).toBe("work:over-and-done");
    expect(oeuvreSelectionnee(reference(), "inconnue")?.id).toBe("work:over-and-done");
    expect(oeuvreSelectionnee(reference(), "work:come-and-get-it")?.id).toBe(
      "work:come-and-get-it",
    );
  });
  it("projette les quatre colonnes et seulement les liens documentés", () => {
    const data = reference();
    const selected = oeuvreSelectionnee(data);
    if (!selected) throw new Error("Œuvre manquante");
    const projection = genealogieProjection(data, selected);
    expect(projection.columns.map((column) => column.length)).toEqual([1, 3, 4, 4]);
    expect(projection.columns[1]?.map((card) => card.node.props["isrc"])).toContain("FRPHC2200048");
    expect(projection.columns[2]?.map((card) => card.node.props["upc"])).toContain("3616405640078");
    expect(projection.columns[3]?.map((card) => card.url)).toContain(
      "https://www.deezer.com/album/157842052",
    );
    expect(
      projection.connections.find(
        (c) => c.from === "work:over-and-done" && c.to === "recording:FRPHC2000053",
      )?.edge.basis,
    ).toBe("inferred");
    expect(projection.connections.filter((c) => c.to.includes("|platform:"))).toHaveLength(4);
  });
  it("rattache les anomalies par ISRC dans les items, y compris les variantes", () => {
    const data = reference();
    const original = data.nodes.find((n) => n.id === "recording:FRPHC2000053");
    const remix = data.nodes.find((n) => n.id === "recording:FRPHC2200048");
    const alternate = data.nodes.find((n) => n.id === "recording:FRPHC2000007");
    if (!original || !remix || !alternate) throw new Error("Enregistrements manquants");
    expect(anomaliesEnregistrement(data, original).map((a) => a.id)).toContain("A11");
    expect(anomaliesEnregistrement(data, alternate).map((a) => a.id)).toContain("A11");
    expect(anomaliesEnregistrement(data, remix).map((a) => a.id)).toContain("A10");
    expect(anomaliesEnregistrement(data, { ...original, props: { isrc: "FRPHC200005" } })).toEqual(
      [],
    );
  });
  it("conserve les détails permettant d’ouvrir la bonne anomalie", () => {
    const anomaly = reference().anomalies.find((a) => a.id === "A11");
    expect(anomaly?.description).toContain("ISRC");
    expect(anomaly?.suggested_action).toBeTruthy();
    expect(anomaly?.items?.[0]?.["isrc_1"]).toBe("FRPHC2000053");
  });
  it("associe les trois objets à leurs droits respectifs", () => {
    expect(droits["work"]).toBe("Droits d’auteur");
    expect(droits["recording"]).toBe("Droits voisins");
    expect(droits["release"]).toBe("Distribution");
  });
});
