import type { ArtistStatus, JobStatus, StepStatus } from "./backend";

export const sourcesNoms: Record<string, string> = {
  musicbrainz: "MusicBrainz",
  deezer: "Deezer",
  spotify: "Spotify",
  youtube: "YouTube",
  discogs: "Discogs",
  wikidata: "Wikidata",
  apple_music: "Apple Music",
  lastfm: "Last.fm",
  isni: "ISNI",
  ipi: "IPI",
};

/** Ordre d'affichage des étapes de collecte. */
export const ordreSources = [
  "musicbrainz",
  "deezer",
  "spotify",
  "youtube",
  "discogs",
  "wikidata",
  "apple_music",
];

export function nomSource(id: string): string {
  return sourcesNoms[id] ?? id;
}

export const etapesStatuts: Record<StepStatus, string> = {
  running: "En cours",
  done: "Terminé",
  error: "Erreur",
  not_configured: "Non configuré",
  rate_limited: "Quota atteint",
  no_connector: "Repéré, pas encore collecté",
};

export const jobsStatuts: Record<JobStatus, string> = {
  queued: "En attente",
  running: "En cours",
  done: "Terminé",
  error: "Erreur",
};

export const artistesStatuts: Record<ArtistStatus, string> = {
  pending: "En attente",
  collecting: "Collecte en cours",
  ready: "Prêt",
  error: "Erreur",
};

export const typesCatalogue: Record<string, string> = {
  recording: "Enregistrements",
  release: "Sorties",
  release_group: "Albums et singles",
  work: "Œuvres",
};

export const methodesLien: Record<string, string> = {
  user_selected: "choisi par vous",
};

export function methodeLien(method: string): string {
  if (method.startsWith("declared:")) {
    return `déclaré par ${method.slice(9).split("+").map(nomSource).join(", ")}`;
  }
  return methodesLien[method] ?? method;
}

export const anomaliesTypes: Record<string, string> = {
  conflicting_identifier: "Identifiant contradictoire",
};

export function dureeFr(seconds: number | null | undefined): string {
  if (seconds == null || Number.isNaN(seconds)) return "—";
  const s = Math.round(seconds);
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}
