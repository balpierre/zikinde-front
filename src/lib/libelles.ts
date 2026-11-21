export const typesNoeuds: Record<string, string> = {
  artist: "Artiste",
  group: "Groupe",
  person: "Personne",
  label: "Label",
  platform: "Plateforme",
  work: "Œuvre",
  recording: "Enregistrement",
  release: "Sortie",
};
export const bases: Record<string, string> = { declared: "déclarée", inferred: "inférée" };
export const typesSorties: Record<string, string> = { album: "Album", single: "Single", ep: "EP" };
export const statuts: Record<string, string> = {
  concordant: "Concordant",
  divergent: "Divergent",
  source_unique: "Source unique",
  absent: "Absent",
};
export const categories: Record<string, string> = {
  écoute: "Écoute",
  référentiel: "Référentiel",
  "réseau social": "Réseau social",
  audience: "Audience",
  streaming: "Écoute",
  listening: "Écoute",
  listen: "Écoute",
  ecoute: "Écoute",
  sales: "Vente",
  sale: "Vente",
  shop: "Vente",
  vente: "Vente",
  reference: "Référentiel",
  database: "Référentiel",
  referentiel: "Référentiel",
  social: "Réseau social",
  social_network: "Réseau social",
};
export function nombre(value: number | null | undefined): string {
  return value == null
    ? "—"
    : new Intl.NumberFormat("fr-FR").format(value).replace(/[\u202f\u00a0]/g, " ");
}
export function dateFr(value: string | null | undefined): string {
  if (!value) return "Date de collecte non renseignée";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? "Date de collecte non renseignée"
    : new Intl.DateTimeFormat("fr-FR", {
        day: "numeric",
        month: "long",
        year: "numeric",
        timeZone: "UTC",
      }).format(date);
}
export function correspondSenbei(query: string): boolean {
  const normalized = query
    .trim()
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase();
  return normalized.length >= 2 && "senbei".startsWith(normalized);
}
export function couverture(
  covered: number | null | undefined,
  total: number | null | undefined,
): string {
  return covered == null || total == null || total === 0
    ? "—"
    : `${nombre(Math.round((covered / total) * 100))} %`;
}

export function valeurFr(field: string, value: string): string {
  if (field === "pays" && value === "FR") return "France";
  if (field === "genres")
    return (
      (
        { electro: "électro", "hip hop": "hip-hop", "trip hop": "trip-hop" } as Record<
          string,
          string
        >
      )[value] ?? value
    );
  return value;
}

export const droits: Record<string, string> = {
  work: "Droits d’auteur",
  recording: "Droits voisins",
  release: "Distribution",
};
export function regleFr(rule: string): string {
  return rule.replace(
    "hors mentions remix/edit/live",
    "hors mentions remix, version éditée ou concert",
  );
}
export function dateObjet(value: string | null | undefined): string {
  if (!value) return "Date non renseignée";
  if (/^\d{4}$/.test(value)) return value;
  if (/^\d{4}-\d{2}$/.test(value))
    return new Intl.DateTimeFormat("fr-FR", {
      month: "long",
      year: "numeric",
      timeZone: "UTC",
    }).format(new Date(`${value}-01`));
  return dateFr(value);
}

export const champs: Record<string, string> = {
  description: "Description",
  qid: "Identifiant Wikidata",
  focus: "Artiste de référence",
  wikidata_qid: "Identifiant Wikidata",
  musicbrainz_id: "Identifiant MusicBrainz",
  iswc: "ISWC",
  isrc: "ISRC",
  upc: "UPC",
  duration_s: "Durée",
  deezer_rank: "Indice de popularité Deezer",
  release_date: "Date de sortie",
  release_type: "Type de sortie",
  nb_tracks: "Nombre de titres",
  fans_deezer: "Abonnés Deezer",
  genres: "Genres",
  deezer_url: "Lien Deezer",
  match_basis: "Règle de rapprochement",
  discogs_id: "Identifiant Discogs",
  discogs_collectors: "Collectionneurs Discogs",
  discogs_wantlist: "Listes de souhaits Discogs",
  discogs_kind: "Type de fiche Discogs",
  format: "Format",
  deezer_id: "Identifiant Deezer",
  category: "Catégorie",
  barcode: "Code-barres",
  nom: "Nom",
  pays: "Pays",
  ville: "Ville",
  label: "Label",
  isni: "ISNI",
  titre: "Titre",
  duree_s: "Durée",
  date: "Date",
  nombre_sorties: "Nombre de sorties",
  qualite_fiche: "Qualité de la fiche",
  identifier: "Identifiant",
  url: "Lien",
  position: "Position",
  disk: "Disque",
  musicbrainz: "MusicBrainz",
  deezer: "Deezer",
  wikidata: "Wikidata",
  discogs: "Discogs",
};
export function libelleChamp(field: string): string {
  if (champs[field]) return champs[field];
  if (field.startsWith("id_"))
    return `Identifiant ${({ "apple-music": "Apple Music", "last-fm": "Last.fm", spotify: "Spotify", facebook: "Facebook", youtube: "YouTube", soundcloud: "SoundCloud", bandcamp: "Bandcamp", instagram: "Instagram", tiktok: "TikTok", x: "X", beatport: "Beatport", tidal: "Tidal", twitch: "Twitch", allmusic: "AllMusic", viaf: "VIAF", isni: "ISNI", musicbrainz: "MusicBrainz", discogs: "Discogs", deezer: "Deezer" } as Record<string, string>)[field.slice(3)] ?? "externe"}`;
  return "Propriété complémentaire";
}
export function proprieteFr(field: string, value: unknown): string {
  if (value == null) return "Non renseigné";
  if (typeof value === "boolean") return value ? "Oui" : "Non";
  if (typeof value === "number")
    return ["duration_s", "duree_s"].includes(field)
      ? `${nombre(Math.floor(value / 60))} min ${nombre(value % 60)} s`
      : nombre(value);
  if (Array.isArray(value)) return value.map((v) => proprieteFr(field, v)).join(", ");
  if (typeof value === "object")
    return Object.entries(value)
      .map(([key, v]) => `${libelleChamp(key)} : ${proprieteFr(key, v)}`)
      .join(" · ");
  if (typeof value !== "string") return "Non renseigné";
  if (["release_date", "date"].includes(field)) return dateObjet(value);
  if (field === "release_type") return typesSorties[value] ?? "Type non renseigné";
  if (field === "category") return categories[value] ?? "Catégorie non renseignée";
  if (field === "discogs_kind")
    return (
      ({ master: "Édition de référence", release: "Sortie" } as Record<string, string>)[value] ??
      "Type non renseigné"
    );
  return valeurFr(field, value);
}
