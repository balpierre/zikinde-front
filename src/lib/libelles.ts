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
// Discogs credits keep their English role names in the source file.
const rolesCredit: Record<string, string> = {
  artwork: "illustration",
  "artwork by": "illustration",
  "mastered by": "mastering",
  "mixed by": "mixage",
  scratches: "scratch",
};
const relationsAgregees: Record<string, string> = {
  via_sorties: "via sorties",
  sans_label: "sorties sans label",
};
export const libelleSansLabel = "[Not on label]";
export const libelleArtistesProches = "Artistes proches";
export const libelleRelationEntrante = "relation entrante";
export function libelleRelation(type: string, label: string): string {
  if (type === "via_releases") return relationsAgregees[label] ?? "via sorties";
  // An untranslated Discogs role keeps its source name so distinct roles stay distinct.
  return (
    rolesCredit[label.toLowerCase()] ?? (type === "credited_on" ? `crédité sur · ${label}` : label)
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

export const gravites: Record<string, string> = {
  haute: "Haute",
  moyenne: "Moyenne",
  faible: "Faible",
  info: "Info",
};
export const typesAnomalies: Record<string, string> = {
  label_divergent: "Label divergent",
  identifiant_divergent: "Identifiant divergent",
  valeur_divergente: "Valeur divergente",
  doublon_lien: "Lien en double",
  isrc_manquant: "ISRC manquant",
  sortie_absente: "Sortie absente",
  oeuvre_sans_iswc: "Œuvre sans ISWC",
  oeuvre_non_documentee: "Œuvre non documentée",
  duree_divergente: "Durée divergente",
  isrc_titres_differents: "ISRC à titres différents",
  isrc_double: "ISRC en double",
  date_divergente: "Date divergente",
  fiabilite_source: "Fiabilité de la source",
};
export function libelleTypeAnomalie(type: string | undefined): string {
  if (!type) return "Type non renseigné";
  return typesAnomalies[type] ?? "Autre type d’anomalie";
}
export const statutsFermes = ["closed", "resolved", "fermée", "résolue"];
export const destinataires: Record<string, string> = {
  interne: "Interne (label / éditeur)",
  distributeur: "Distributeur",
  musicbrainz: "MusicBrainz",
  wikidata: "Wikidata",
  discogs: "Discogs",
};
export const etatsLocaux: Record<string, string> = {
  a_traiter: "À traiter",
  valeur_choisie: "Valeur choisie",
  demande_preparee: "Demande préparée",
  ignoree: "Ignorée",
};
export const statutsSource: Record<string, string> = {
  ouverte: "Ouverte",
  open: "Ouverte",
  fermée: "Fermée",
  closed: "Fermée",
  résolue: "Résolue",
  resolved: "Résolue",
};
export const mentionLectureSeule =
  "Zikindé ne modifie jamais directement les plateformes tierces : les décisions restent dans ce navigateur et les demandes de correction sont des brouillons à transmettre vous-même.";
// Anomaly items reuse short source keys; "label" is the title of the concerned object there.
const colonnesElements: Record<string, string> = {
  label: "Titre",
  isrc_deezer: "ISRC Deezer",
  deezer_s: "Durée Deezer",
  musicbrainz_s: "Durée MusicBrainz",
  isrc_1: "ISRC 1",
  isrc_2: "ISRC 2",
  sorties_1: "Sorties de l’ISRC 1",
  sorties_2: "Sorties de l’ISRC 2",
  deezer: "Deezer",
  musicbrainz: "MusicBrainz",
};
export function libelleColonneElement(key: string): string {
  return colonnesElements[key] ?? champs[key] ?? libelleChamp(key);
}
export function valeurElement(key: string, value: unknown): string {
  if (["deezer_s", "musicbrainz_s"].includes(key) && typeof value === "number")
    return proprieteFr("duree_s", value);
  if (typeof value === "string" && /^\d{4}-\d{2}(-\d{2})?$/.test(value)) return dateObjet(value);
  return proprieteFr(key, value);
}
export const typesNoeudsPluriel: Record<string, string> = {
  work: "Œuvres",
  recording: "Enregistrements",
  release: "Sorties",
  artist: "Artistes",
  group: "Groupes",
  person: "Personnes",
  label: "Labels",
  platform: "Plateformes",
};
