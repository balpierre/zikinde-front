import { describe, expect, it } from "vitest";
import { explicationDemo } from "@/lib/explication-ia";
import type { Anomaly } from "@/lib/referentiel";

const anomalie = (type?: string): Anomaly => ({
  id: "A01",
  label: "Test",
  status: "open",
  ...(type === undefined ? {} : { type }),
});

describe("Explication IA de démonstration", () => {
  it("répond pour les règles prises en charge, sous leur nom backend ou démo", () => {
    expect(explicationDemo(anomalie("missing_isrc"))?.kind).toBe("missing_isrc");
    expect(explicationDemo(anomalie("isrc_manquant"))?.kind).toBe("missing_isrc");
    expect(explicationDemo(anomalie("work_without_iswc"))?.kind).toBe("work_without_iswc");
    expect(explicationDemo(anomalie("oeuvre_sans_iswc"))?.kind).toBe("work_without_iswc");
  });

  it("ne répond pas pour les autres règles", () => {
    for (const type of [undefined, "label_mismatch", "isrc_double", "toString"])
      expect(explicationDemo(anomalie(type))).toBeNull();
  });

  it("ne cite que des preuves fournies et se déclare synthétique", () => {
    for (const type of ["missing_isrc", "work_without_iswc"]) {
      const e = explicationDemo(anomalie(type))!;
      expect(e.synthetic).toBe(true);
      expect(e.evidence_ids.every((id) => e.evidence.some((p) => p.id === id))).toBe(true);
    }
  });
});
