import type { Anomaly } from "./referentiel";

/** Output of `python -m pipeline.audit_ai` in the backend (see zikinde/docs/AUDIT_AI.md). */
export interface ExplicationIA {
  anomaly_id: number | null;
  kind: string;
  model: string;
  summary: string;
  evidence_ids: string[];
  next_action: string;
  evidence: {
    id: string;
    source: string;
    source_id: string;
    url: string;
    fetched_at: string;
    value: string;
  }[];
  synthetic?: boolean;
}

// Backend kinds first, then the names of the static Senbeï demo for the same rules.
const TYPES_EXPLICABLES: Record<string, "missing_isrc" | "work_without_iswc"> = {
  missing_isrc: "missing_isrc",
  isrc_manquant: "missing_isrc",
  work_without_iswc: "work_without_iswc",
  oeuvre_sans_iswc: "work_without_iswc",
};

const MODELE = "deepseek/deepseek-v4.1-flash";
const COLLECTE = "2026-01-01T00:00:00Z";

// Fixed answers until the worker stores real ones in `anomalies.details.ai_explanation`.
const DEMOS: Record<"missing_isrc" | "work_without_iswc", ExplicationIA> = {
  missing_isrc: {
    anomaly_id: null,
    kind: "missing_isrc",
    model: MODELE,
    summary:
      "In this synthetic example, MusicBrainz lists an ISRC for only 3 of the artist's 10 recordings [e1]. The remaining recordings cannot be linked to their releases by a standard identifier.",
    evidence_ids: ["e1"],
    next_action:
      "Check the ISRC field of each recording without one on its MusicBrainz page against the distributor's catalogue before submitting any code.",
    evidence: [
      {
        id: "e1",
        source: "musicbrainz",
        source_id: "demo-artist",
        url: "https://example.invalid/artist/demo-artist",
        fetched_at: COLLECTE,
        value: "In this synthetic example, an ISRC is present for 3 of 10 recordings.",
      },
    ],
    synthetic: true,
  },
  work_without_iswc: {
    anomaly_id: null,
    kind: "work_without_iswc",
    model: MODELE,
    summary:
      "In this synthetic example, both MusicBrainz and Wikidata list the work without an ISWC [e1, e2]. Its registration with a collecting society therefore remains unverified.",
    evidence_ids: ["e1", "e2"],
    next_action:
      "Check the ISWC field of the work in the publisher's registration records, then compare it with the MusicBrainz work page.",
    evidence: [
      {
        id: "e1",
        source: "musicbrainz",
        source_id: "demo-work",
        url: "https://example.invalid/work/demo-work",
        fetched_at: COLLECTE,
        value: "In this synthetic example, the source lists the work without an ISWC.",
      },
      {
        id: "e2",
        source: "wikidata",
        source_id: "Q0",
        url: "https://example.invalid/wiki/Q0",
        fetched_at: COLLECTE,
        value: "In this synthetic example, the source lists the work without an ISWC.",
      },
    ],
    synthetic: true,
  },
};

export function explicationDemo(anomaly: Anomaly): ExplicationIA | null {
  const type = anomaly.type;
  return type && Object.hasOwn(TYPES_EXPLICABLES, type) ? DEMOS[TYPES_EXPLICABLES[type]!] : null;
}
