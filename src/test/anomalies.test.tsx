import { readFileSync } from "node:fs";
import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import {
  GRAVITES,
  brouillonInitial,
  demandeCorrection,
  demandesPreparees,
  etapesDestinataires,
  etatLocal,
  filtrerAnomalies,
  filtresParDefaut,
  referenceSchema,
  ignoreeSchema,
  trierParGravite,
} from "@/lib/anomalies";
import {
  affirmationsCsv,
  demandesCsv,
  demandesJson,
  noeudsCsv,
  referentielJson,
  relationsCsv,
  typesExportables,
  versCsv,
} from "@/lib/exports";
import { useDecisions } from "@/hooks/use-decisions";
import {
  libelleColonneElement,
  libelleTypeAnomalie,
  mentionLectureSeule,
  valeurElement,
} from "@/lib/libelles";
import { parseReferentiel } from "@/lib/referentiel";

function reference() {
  const result = parseReferentiel(
    JSON.parse(readFileSync("public/data/referentiel_senbei.json", "utf8")) as unknown,
  );
  if (!result.data) throw new Error("Référentiel invalide");
  return result.data;
}
const brut = JSON.parse(readFileSync("public/data/referentiel_senbei.json", "utf8")) as {
  anomalies: { id: string; observations: { value: unknown; url: string }[] }[];
};
const entetes = (csv: string) =>
  csv
    .replace(/^\uFEFF/, "")
    .split("\r\n")[0]!
    .split(";");

describe("Normalisation des anomalies", () => {
  it("garde la valeur et le lien de chaque observation", () => {
    const data = reference();
    for (const raw of brut.anomalies) {
      const anomaly = data.anomalies.find((a) => a.id === raw.id)!;
      expect(anomaly.observations?.map((o) => [o.value, o.source.source_url])).toEqual(
        raw.observations.map((o) => [o.value, o.url]),
      );
      expect(anomaly.type).toBeTruthy();
      expect(anomaly.target).toBeTruthy();
    }
  });
});

describe("Tri, destinataires et filtres", () => {
  it("trie par gravité haute, moyenne, faible puis info", () => {
    const rangs = trierParGravite(reference().anomalies).map((a) =>
      GRAVITES.indexOf(a.severity as (typeof GRAVITES)[number]),
    );
    expect(rangs).toEqual([...rangs].sort((a, b) => a - b));
    expect(rangs.every((r) => r >= 0)).toBe(true);
  });
  it("traduit chaque destinataire libre en étapes ordonnées", () => {
    expect(
      etapesDestinataires(
        "Interne label / éditeur (vérifier le dépôt), puis Wikidata / MusicBrainz",
      ),
    ).toEqual(["interne", "wikidata", "musicbrainz"]);
    expect(
      etapesDestinataires("Wikidata / MusicBrainz, puis distributeur si doublon de profil"),
    ).toEqual(["wikidata", "musicbrainz", "distributeur"]);
    expect(etapesDestinataires("Distributeur → Deezer")).toEqual(["distributeur"]);
    expect(etapesDestinataires("Discogs (édition ouverte)")).toEqual(["discogs"]);
    expect(etapesDestinataires(undefined)).toEqual([]);
    for (const anomaly of reference().anomalies)
      expect(etapesDestinataires(anomaly.target).length).toBeGreaterThan(0);
  });
  it("masque les ignorées par défaut et les retrouve par filtre", () => {
    const data = reference();
    const [premiere] = data.anomalies;
    const decisions = { [premiere!.id]: { ignoree: { motif: "Attendu", date: "2026-11-21" } } };
    const parDefaut = filtrerAnomalies(data.anomalies, filtresParDefaut, decisions);
    expect(parDefaut.map((a) => a.id)).not.toContain(premiere!.id);
    expect(parDefaut).toHaveLength(data.anomalies.length - 1);
    const ignorees = filtrerAnomalies(
      data.anomalies,
      { ...filtresParDefaut, etat: "ignoree" },
      decisions,
    );
    expect(ignorees.map((a) => a.id)).toEqual([premiere!.id]);
  });
  it("filtre par gravité, destinataire et type", () => {
    const data = reference();
    const hautes = filtrerAnomalies(
      data.anomalies,
      { ...filtresParDefaut, gravites: ["haute"] },
      {},
    );
    expect(hautes.every((a) => a.severity === "haute")).toBe(true);
    const discogs = filtrerAnomalies(
      data.anomalies,
      { ...filtresParDefaut, destinataire: "discogs" },
      {},
    );
    expect(discogs.every((a) => etapesDestinataires(a.target).includes("discogs"))).toBe(true);
    expect(discogs.length).toBeGreaterThan(0);
    const type = data.anomalies[0]!.type!;
    expect(
      filtrerAnomalies(data.anomalies, { ...filtresParDefaut, type }, {}).every(
        (a) => a.type === type,
      ),
    ).toBe(true);
  });
});

describe("Décisions locales", () => {
  it("exige une note pour la valeur de référence et un motif pour ignorer", () => {
    const base = { observation: 0, valeur: "Banzaï Lab", date: "2026-11-21" };
    expect(referenceSchema.safeParse({ ...base, note: "  " }).success).toBe(false);
    expect(referenceSchema.safeParse({ ...base, note: "Contrat 2023" }).success).toBe(true);
    expect(
      referenceSchema.safeParse({ ...base, observation: null, valeur: "", note: "x" }).success,
    ).toBe(false);
    expect(ignoreeSchema.safeParse({ motif: "", date: "" }).success).toBe(false);
  });
  it("donne la priorité à l’ignorance, puis à la demande, puis à la valeur", () => {
    const reference = { observation: null, valeur: "x", note: "y", date: "d" };
    const brouillon = {
      destinataire: "interne" as const,
      valeurProposee: "",
      message: "",
      date: "d",
    };
    expect(etatLocal(undefined)).toBe("a_traiter");
    expect(etatLocal({ reference })).toBe("valeur_choisie");
    expect(etatLocal({ reference, brouillon })).toBe("demande_preparee");
    expect(etatLocal({ reference, brouillon, ignoree: { motif: "m", date: "d" } })).toBe("ignoree");
  });
  it("préremplit le brouillon avec la première étape et la valeur de référence", () => {
    const anomaly = reference().anomalies.find((a) => a.id === "A07")!;
    const draft = brouillonInitial(
      anomaly,
      {
        reference: { observation: null, valeur: "T-123.456.789-0", note: "Dépôt SACEM", date: "d" },
      },
      "2026-11-21T10:00:00.000Z",
    );
    expect(draft.destinataire).toBe("interne");
    expect(draft.valeurProposee).toBe("T-123.456.789-0");
    expect(draft.message).toContain("Dépôt SACEM");
    expect(draft.date).toBe("2026-11-21T10:00:00.000Z");
  });
  it("prend les valeurs actuelles dans les éléments quand il n’y a pas d’observation", () => {
    const data = reference();
    for (const id of ["A09", "A10", "A12"]) {
      const anomaly = data.anomalies.find((a) => a.id === id)!;
      expect(anomaly.observations).toEqual([]);
      const demande = demandeCorrection(anomaly, brouillonInitial(anomaly, undefined, "d"));
      expect(demande.valeursActuelles).toHaveLength(anomaly.items!.length);
      expect(demande.valeursActuelles.every((v) => v.source && v.valeur)).toBe(true);
    }
    const a10 = data.anomalies.find((a) => a.id === "A10")!;
    expect(
      demandeCorrection(a10, brouillonInitial(a10, undefined, "d")).valeursActuelles[0]!.valeur,
    ).toContain("ISRC : FRPHC2200048");
  });
  it("affiche une anomalie de gravité inconnue quand toutes les gravités sont cochées", () => {
    const data = reference();
    const inconnue = { ...data.anomalies[0]!, id: "A99", severity: "critique" };
    expect(filtrerAnomalies([inconnue], filtresParDefaut, {}).map((a) => a.id)).toEqual(["A99"]);
    expect(filtrerAnomalies([inconnue], { ...filtresParDefaut, gravites: ["haute"] }, {})).toEqual(
      [],
    );
  });
  it("rassemble valeurs actuelles et preuves sans doublon", () => {
    const anomaly = reference().anomalies.find((a) => a.id === "A05")!;
    const demande = demandeCorrection(anomaly, brouillonInitial(anomaly, undefined, "d"));
    expect(demande.valeursActuelles.map((v) => v.source)).toEqual(
      anomaly.observations!.map((o) => o.source.name),
    );
    expect(new Set(demande.preuves).size).toBe(demande.preuves.length);
    expect(demande.preuves.length).toBeGreaterThan(anomaly.observations!.length);
  });
  it("ne liste que les anomalies dont la demande est préparée", () => {
    const data = reference();
    const anomaly = data.anomalies[3]!;
    const demandes = demandesPreparees(data.anomalies, {
      [anomaly.id]: { brouillon: brouillonInitial(anomaly, undefined, "d") },
      [data.anomalies[4]!.id]: { ignoree: { motif: "m", date: "d" } },
    });
    expect(demandes.map((d) => d.anomalie)).toEqual([anomaly.id]);
  });
});

describe("Mémoire locale", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    window.localStorage.clear();
  });
  it("conserve les décisions après rechargement", () => {
    const first = renderHook(() => useDecisions("artist:test"));
    act(() => first.result.current.modifier("A01", () => ({ ignoree: { motif: "m", date: "d" } })));
    first.unmount();
    const second = renderHook(() => useDecisions("artist:test"));
    expect(second.result.current.decisions["A01"]?.ignoree?.motif).toBe("m");
  });
  it("garde les décisions valides d’un stockage partiellement corrompu", () => {
    window.localStorage.setItem(
      "zikinde:decisions:v1:artist:test",
      JSON.stringify({
        A01: { ignoree: { motif: "m", date: "d" } },
        A02: { ignoree: { motif: "" } },
      }),
    );
    const { result } = renderHook(() => useDecisions("artist:test"));
    expect(Object.keys(result.current.decisions)).toEqual(["A01"]);
    expect(result.current.persistant).toBe(true);
  });
  it("signale dès le chargement un stockage illisible", () => {
    vi.spyOn(Storage.prototype, "getItem").mockImplementation(() => {
      throw new Error("bloqué");
    });
    const { result } = renderHook(() => useDecisions("artist:test"));
    expect(result.current.persistant).toBe(false);
  });
  it("ignore un stockage corrompu et signale un stockage indisponible", () => {
    window.localStorage.setItem("zikinde:decisions:v1:artist:test", "{pas du json");
    const { result } = renderHook(() => useDecisions("artist:test"));
    expect(result.current.decisions).toEqual({});
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new Error("quota");
    });
    act(() => result.current.modifier("A01", () => ({ ignoree: { motif: "m", date: "d" } })));
    expect(result.current.persistant).toBe(false);
    expect(result.current.decisions["A01"]?.ignoree?.motif).toBe("m");
  });
});

describe("Exports", () => {
  it("neutralise les formules en tête de cellule", () => {
    const csv = versCsv(
      [{ titre: "Valeur", valeur: (l: string) => l }],
      ['=HYPERLINK("x")', "+33 6", "-12", "@SUM(A1)", "Banzaï Lab"],
    );
    expect(csv.split("\r\n").slice(1)).toEqual([
      '"\'=HYPERLINK(""x"")"',
      "'+33 6",
      "'-12",
      "'@SUM(A1)",
      "Banzaï Lab",
    ]);
  });
  it("écrit un CSV lisible par Excel en français", () => {
    const csv = versCsv(
      [
        { titre: "Titre", valeur: (l: string) => l },
        { titre: "Note", valeur: () => "a;b" },
      ],
      ['Dit "bonjour"'],
    );
    expect(csv.startsWith("\uFEFF")).toBe(true);
    expect(csv).toBe('\uFEFFTitre;Note\r\n"Dit ""bonjour""";"a;b"');
  });
  it("exporte les demandes avec des en-têtes français et la mention de lecture seule", () => {
    const data = reference();
    const anomaly = data.anomalies[0]!;
    const demandes = [demandeCorrection(anomaly, brouillonInitial(anomaly, undefined, "d"))];
    expect(entetes(demandesCsv(demandes))).toEqual([
      "Anomalie",
      "Titre",
      "Destinataire",
      "Champ",
      "Valeurs actuelles",
      "Valeur proposée",
      "Message",
      "Liens de preuve",
      "Date",
    ]);
    const json = JSON.parse(demandesJson(demandes, "2026-11-21")) as {
      avertissement: string;
      demandes: unknown[];
    };
    expect(json.avertissement).toBe(mentionLectureSeule);
    expect(json.demandes).toHaveLength(1);
  });
  it("exporte chaque type d’objet avec sa provenance et des en-têtes uniques", () => {
    const data = reference();
    for (const type of typesExportables) {
      const csv = noeudsCsv(data, type);
      const colonnes = entetes(csv);
      expect(new Set(colonnes).size).toBe(colonnes.length);
      expect(colonnes).toEqual(
        expect.arrayContaining(["Sources", "Liens des sources", "Dates de collecte"]),
      );
      expect(csv.split("\r\n")).toHaveLength(data.nodes.filter((n) => n.type === type).length + 1);
      expect(colonnes.filter((c) => /^[a-z_]+$/.test(c) || c.includes("complémentaire"))).toEqual(
        [],
      );
    }
    expect(entetes(relationsCsv(data))).toContain("Relation");
    expect(entetes(affirmationsCsv(data))).toContain("Valeur");
  });
  it("exporte le référentiel JSON avec provenance", () => {
    const data = reference();
    const json = JSON.parse(referentielJson(data, "2026-11-21")) as {
      avertissement: string;
      meta: { sources: unknown[]; notes: string[] };
      claims: { sources: unknown[] }[];
    };
    expect(json.avertissement).toBe(mentionLectureSeule);
    expect(json.meta.sources.length).toBeGreaterThan(0);
    expect(json.meta.notes.length).toBeGreaterThan(0);
    expect(json.claims.every((c) => c.sources.length > 0)).toBe(true);
  });
  it("traduit les colonnes des éléments concernés", () => {
    const data = reference();
    const cles = new Set(data.anomalies.flatMap((a) => (a.items ?? []).flatMap(Object.keys)));
    for (const key of cles) expect(libelleColonneElement(key)).not.toBe("Propriété complémentaire");
    expect(libelleColonneElement("label")).toBe("Titre");
    expect(valeurElement("deezer_s", 87)).toBe("1 min 27 s");
    expect(valeurElement("deezer", "2018-01-26")).toBe("26 janvier 2018");
    expect(libelleTypeAnomalie(undefined)).toBe("Type non renseigné");
    expect(libelleTypeAnomalie("nouveau")).toBe("Autre type d’anomalie");
  });
});
