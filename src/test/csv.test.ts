import { describe, expect, it } from "vitest";
import { parseCsv } from "@/lib/csv";

describe("Lecture des CSV d’import", () => {
  it("lit un CSV séparé par des virgules avec en-tête", () => {
    expect(parseCsv("titre,isrc\nOver and done,FRPHC2000053\n")).toEqual({
      colonnes: ["titre", "isrc"],
      lignes: [{ titre: "Over and done", isrc: "FRPHC2000053" }],
    });
  });
  it("détecte le point-virgule, retire le BOM et gère CRLF", () => {
    const { colonnes, lignes } = parseCsv("\uFEFFtitre;upc\r\nA, B;123\r\n\r\nC;456");
    expect(colonnes).toEqual(["titre", "upc"]);
    expect(lignes).toEqual([
      { titre: "A, B", upc: "123" },
      { titre: "C", upc: "456" },
    ]);
  });
  it("gère les guillemets, les guillemets doublés et les retours à la ligne", () => {
    const { lignes } = parseCsv('titre,label\n"Dit ""bonjour"", ok","Label\nNord"\n');
    expect(lignes).toEqual([{ titre: 'Dit "bonjour", ok', label: "Label\nNord" }]);
  });
  it("complète les cellules manquantes et nomme les colonnes vides", () => {
    expect(parseCsv("titre,,date\nX").lignes).toEqual([{ titre: "X", colonne_2: "", date: "" }]);
  });
  it("renvoie un résultat vide pour un fichier vide", () => {
    expect(parseCsv("")).toEqual({ colonnes: [], lignes: [] });
  });
});
