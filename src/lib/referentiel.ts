import { queryOptions } from "@tanstack/react-query";
import { z } from "zod";
import { nombre, valeurFr } from "./libelles";
import { supabase } from "./supabase";

/** Sources historiques du pipeline, affichées en premier ; les imports manuels s’ajoutent après. */
export const SOURCES = ["Wikidata", "MusicBrainz", "Deezer", "Discogs"] as const;
export type SourceName = (typeof SOURCES)[number];
export interface Source {
  name: string;
  source_url: string;
  collected_at?: string;
  count?: number;
  contribution?: string;
}
/** Compte mis de côté (homonyme probable ou refusé par un humain) : il n’alimente pas le référentiel. */
export interface SetAside {
  link_id: number;
  source: string;
  source_id: string;
  name: string;
  url?: string | null;
  status: string;
  reason?: string | null;
  score?: number | null;
}
export interface Meta {
  focus_artist?: string;
  artist_name?: string;
  description?: string;
  genres?: string[];
  collected_at?: string;
  sources?: Source[];
  notes?: string[];
  set_aside?: SetAside[];
  /** Profil du label client (plan 02) ; absent avant déploiement du back. */
  label_profile?: { names: string[]; upc_prefixes: string[]; isrc_registrants: string[] };
}
export interface Stats {
  works?: number;
  recordings?: number;
  releases?: number;
  anomalies?: number;
  works_with_iswc?: number;
  recordings_with_isrc?: number;
  /** Sorties et enregistrements par appartenance (plan 02) ; absent avant déploiement. */
  ownership?: Record<string, number>;
}
export interface MatrixValue {
  value: string | string[] | number | null;
  source_url?: string;
  collected_at?: string;
  sources?: Source[];
}
export interface MatrixRow {
  field: string;
  label: string;
  status: "concordant" | "divergent" | "source_unique" | "absent";
  /** Valeurs indexées par nom de source (libellé de `meta.sources`). */
  values: Record<string, MatrixValue>;
}
export interface Node {
  id: string;
  type: string;
  label: string;
  props: Record<string, unknown>;
  sources?: Source[];
}
export interface Edge {
  id: string;
  source: string;
  target: string;
  type: string;
  label: string;
  basis?: "declared" | "inferred";
  rule?: string;
  props: Record<string, unknown>;
  sources?: Source[];
}
export interface Claim {
  id: string;
  node_id: string;
  field: string;
  value: string | number | string[] | null;
  sources: Source[];
}
export interface Genealogy {
  id: string;
  label: string;
  node_ids: string[];
  edge_ids: string[];
}
export interface Anomaly {
  description?: string;
  suggested_action?: string;
  severity?: string;
  items?: Record<string, unknown>[];
  id: string;
  label: string;
  status: string;
  node_ids?: string[];
  sources?: Source[];
  type?: string;
  field?: string;
  target?: string;
  observations?: Observation[];
  /** Périmètre de l’anomalie (plan 02) : « client » = à traiter ; absent avant déploiement. */
  scope?: string;
}
export interface Observation {
  source: Source;
  value: string | number | string[] | null;
}
export interface Referentiel {
  meta: Meta;
  stats: Stats;
  matrix: MatrixRow[];
  genealogies: Genealogy[];
  anomalies: Anomaly[];
  nodes: Node[];
  edges: Edge[];
  claims: Claim[];
}
export interface ReferentielResult {
  data: Referentiel | null;
  state: "ready" | "missing" | "invalid" | "unavailable";
}
const source = z.object({
  name: z.string(),
  source_url: z.string(),
  collected_at: z.string().optional(),
  count: z.number().optional(),
  contribution: z.string().optional(),
});
const value = z.union([z.string(), z.number(), z.array(z.string()), z.null()]);
const sources = z.array(source).optional();
const props = z.record(z.unknown()).default({});
const schema = z.object({
  meta: z.object({
    artist_name: z.string().optional(),
    description: z.string().optional(),
    genres: z.array(z.string()).optional(),
    collected_at: z.string().optional(),
    notes: z.array(z.string()).optional(),
    sources,
    // Lu avec tolérance : un élément mal formé ne doit pas rendre tout le référentiel « invalide ».
    set_aside: z
      .array(
        z.object({
          link_id: z.number(),
          source: z.string(),
          source_id: z.string(),
          name: z.string(),
          url: z.string().nullish(),
          status: z.string(),
          reason: z.string().nullish(),
          score: z.number().nullish(),
        }),
      )
      .optional()
      .catch(undefined),
  }),
  stats: z.object({
    works: z.number().optional(),
    recordings: z.number().optional(),
    releases: z.number().optional(),
    anomalies: z.number().optional(),
    works_with_iswc: z.number().optional(),
    recordings_with_isrc: z.number().optional(),
  }),
  matrix: z.array(
    z.object({
      field: z.string(),
      label: z.string(),
      status: z.enum(["concordant", "divergent", "source_unique", "absent"]),
      values: z.record(
        z.object({
          value,
          source_url: z.string().optional(),
          collected_at: z.string().optional(),
          sources,
        }),
      ),
    }),
  ),
  nodes: z.array(z.object({ id: z.string(), type: z.string(), label: z.string(), props, sources })),
  edges: z.array(
    z.object({
      id: z.string(),
      source: z.string(),
      target: z.string(),
      type: z.string(),
      label: z.string(),
      basis: z.enum(["declared", "inferred"]).optional(),
      rule: z.string().optional(),
      props,
      sources,
    }),
  ),
  claims: z.array(
    z.object({
      id: z.string(),
      node_id: z.string(),
      field: z.string(),
      value,
      sources: z.array(source),
    }),
  ),
  genealogies: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      node_ids: z.array(z.string()),
      edge_ids: z.array(z.string()),
    }),
  ),
  anomalies: z.array(
    z.object({
      id: z.string(),
      label: z.string(),
      description: z.string().optional(),
      suggested_action: z.string().optional(),
      severity: z.string().optional(),
      items: z.array(z.record(z.unknown())).optional(),
      status: z.string(),
      node_ids: z.array(z.string()).optional(),
      sources,
      type: z.string().optional(),
      field: z.string().optional(),
      target: z.string().optional(),
      observations: z.array(z.object({ source, value })).optional(),
    }),
  ),
});
const rawSource = z.object({ source: z.string(), url: z.string(), fetched_at: z.string() });
const rawSources = z.array(rawSource);
const rawSchema = z.object({
  meta: z.object({
    generated_at: z.string(),
    query: z.string(),
    pivot: z.string().nullish(),
    match: z
      .object({
        method: z.string().nullish(),
        mbid: z.string().nullish(),
        candidates: z.array(z.string()).optional(),
      })
      .passthrough()
      .nullish(),
    sources: z.array(
      z.object({
        id: z.string(),
        label: z.string(),
        url: z.string().default(""),
        fetched_at: z.string().default(""),
      }),
    ),
    model: z.record(z.unknown()).optional(),
    notes: z.array(z.string()).default([]),
    label_profile: z
      .object({
        names: z.array(z.string()).default([]),
        upc_prefixes: z.array(z.string()).default([]),
        isrc_registrants: z.array(z.string()).default([]),
      })
      .nullish(),
  }),
  focus_artist: z.string(),
  stats: z
    .object({
      nodes_by_type: z.record(z.number()).default({}),
      edges: z.number().optional(),
      claims: z.number().optional(),
      anomalies: z.number().optional(),
      recordings_with_isrc: z.number().optional(),
      works_with_iswc: z.number().optional(),
      ownership: z.record(z.number()).optional(),
    })
    .passthrough(),
  nodes: z.array(
    z.object({ id: z.string(), type: z.string(), label: z.string(), props, sources: rawSources }),
  ),
  edges: z.array(
    z.object({
      id: z.string(),
      from: z.string(),
      to: z.string(),
      type: z.string(),
      label: z.string(),
      basis: z.enum(["declared", "inferred"]).default("declared"),
      rule: z.string().nullish(),
      props,
      sources: rawSources,
    }),
  ),
  claims: z.array(
    z.object({
      entity: z.string(),
      field: z.string(),
      value,
      source: z.string(),
      url: z.string(),
      fetched_at: z.string(),
    }),
  ),
  matrix: z.array(
    z.object({
      field: z.string(),
      label: z.string(),
      status: z.enum(["concordant", "divergent", "source_unique", "absent"]),
      values: z.record(value),
    }),
  ),
  genealogies: z.array(
    z.object({
      work: z.string(),
      recordings: z.array(
        z.object({
          recording: z.string(),
          releases: z.array(z.object({ release: z.string(), position: z.number() })),
        }),
      ),
    }),
  ),
  anomalies: z.array(
    z.object({
      id: z.string(),
      type: z.string(),
      severity: z.string(),
      title: z.string(),
      description: z.string().default(""),
      entity: z.string(),
      field: z.string().default(""),
      status: z.string(),
      observations: z
        .array(z.object({ source: z.string(), value, url: z.string().default("") }))
        .default([]),
      target: z.string().default(""),
      suggested_action: z.string().default(""),
      items: z.array(z.record(z.unknown())).default([]),
      scope: z.string().optional(),
    }),
  ),
});
export type ReferentielFichier = z.infer<typeof rawSchema>;
function normaliser(raw: ReferentielFichier): Referentiel {
  const sourceLabels = new Map(raw.meta.sources.map((s) => [s.id, s.label]));
  const normalizeSource = (s: z.infer<typeof rawSource>): Source => ({
    name: sourceLabels.get(s.source) ?? "Source non identifiée",
    source_url: s.url,
    collected_at: s.fetched_at,
  });
  const nodes: Node[] = raw.nodes.map((n) => ({ ...n, sources: n.sources.map(normalizeSource) }));
  const edges: Edge[] = raw.edges.map((e) => ({
    id: e.id,
    source: e.from,
    target: e.to,
    type: e.type,
    label: e.label,
    basis: e.basis,
    ...(e.rule ? { rule: e.rule } : {}),
    props: e.props,
    sources: e.sources.map(normalizeSource),
  }));
  const claims: Claim[] = raw.claims.map((c, index) => ({
    id: `claim:${index}`,
    node_id: c.entity,
    field: c.field,
    value: c.value,
    sources: [normalizeSource(c)],
  }));
  const focus = nodes.find((n) => n.id === raw.focus_artist);
  const metaSources: Source[] = raw.meta.sources.map((s) => {
    const contributed = raw.nodes.filter((n) =>
      n.sources.some((provenance) => provenance.source === s.id),
    );
    const count = (type: string) => contributed.filter((n) => n.type === type).length;
    const details = [
      count("work") ? `${nombre(count("work"))} œuvres` : "",
      count("recording") ? `${nombre(count("recording"))} enregistrements` : "",
      count("release") ? `${nombre(count("release"))} sorties` : "",
      count("platform") ? `${nombre(count("platform"))} plateformes` : "",
      count("person") ? `${nombre(count("person"))} personnes créditées` : "",
    ].filter(Boolean);
    return {
      name: s.label,
      source_url: s.url,
      collected_at: s.fetched_at,
      count: contributed.length,
      contribution: [s.id === raw.meta.pivot ? "Identité pivot" : "", ...details]
        .filter(Boolean)
        .join(" · "),
    };
  });
  const matrix: MatrixRow[] = raw.matrix.map((row) => {
    const values: MatrixRow["values"] = {};
    // Les clés sont des ids de source (y compris `import:<uuid>`) ; on affiche leur libellé.
    for (const [sourceId, cellValue] of Object.entries(row.values)) {
      const name = sourceLabels.get(sourceId) ?? sourceId;
      const cellClaims = raw.claims.filter(
        (c) => c.entity === raw.focus_artist && c.field === row.field && c.source === sourceId,
      );
      const fallbackSource = metaSources.find((s) => s.name === name);
      values[name] = {
        value: Array.isArray(cellValue)
          ? cellValue.map((v) => valeurFr(row.field, v))
          : typeof cellValue === "string"
            ? valeurFr(row.field, cellValue)
            : cellValue,
        sources: cellClaims.length
          ? cellClaims.map(normalizeSource)
          : fallbackSource
            ? [fallbackSource]
            : [],
      };
    }
    return { field: row.field, label: row.label, status: row.status, values };
  });
  const genreValue = claims.find(
    (c) => c.node_id === raw.focus_artist && c.field === "genres",
  )?.value;
  const genres = Array.isArray(genreValue) ? genreValue.map((v) => valeurFr("genres", v)) : [];
  const genealogies: Genealogy[] = raw.genealogies.map((g) => {
    const nodeIds = [
      g.work,
      ...g.recordings.flatMap((r) => [r.recording, ...r.releases.map((s) => s.release)]),
    ];
    return {
      id: g.work,
      label: nodes.find((n) => n.id === g.work)?.label ?? "Œuvre",
      node_ids: nodeIds,
      edge_ids: edges
        .filter((e) => nodeIds.includes(e.source) && nodeIds.includes(e.target))
        .map((e) => e.id),
    };
  });
  return {
    meta: {
      focus_artist: raw.focus_artist,
      artist_name: focus?.label ?? raw.meta.query,
      ...(typeof focus?.props["description"] === "string"
        ? { description: focus.props["description"] }
        : {}),
      genres,
      collected_at: raw.meta.generated_at,
      notes: raw.meta.notes,
      sources: metaSources,
      ...(raw.meta.label_profile ? { label_profile: raw.meta.label_profile } : {}),
    },
    stats: {
      works: raw.stats.nodes_by_type["work"] ?? 0,
      recordings: raw.stats.nodes_by_type["recording"] ?? 0,
      releases: raw.stats.nodes_by_type["release"] ?? 0,
      anomalies: raw.stats.anomalies ?? raw.anomalies.length,
      ...(raw.stats.works_with_iswc != null ? { works_with_iswc: raw.stats.works_with_iswc } : {}),
      ...(raw.stats.recordings_with_isrc != null
        ? { recordings_with_isrc: raw.stats.recordings_with_isrc }
        : {}),
      ...(raw.stats.ownership ? { ownership: raw.stats.ownership } : {}),
    },
    matrix,
    nodes,
    edges,
    claims,
    genealogies,
    anomalies: raw.anomalies.map((a) => {
      const observations: Observation[] = a.observations.map((o) => {
        const meta = raw.meta.sources.find((s) => s.id === o.source);
        return {
          source: {
            name: meta?.label ?? "Source non identifiée",
            source_url: o.url,
            ...(meta ? { collected_at: meta.fetched_at } : {}),
          },
          value: o.value,
        };
      });
      return {
        id: a.id,
        label: a.title,
        description: a.description,
        suggested_action: a.suggested_action,
        severity: a.severity,
        items: a.items,
        status: a.status,
        node_ids: [a.entity],
        sources: observations.map((o) => o.source),
        type: a.type,
        field: a.field,
        target: a.target,
        observations,
        ...(a.scope ? { scope: a.scope } : {}),
      };
    }),
  };
}
export function parseReferentiel(input: unknown): ReferentielResult {
  const raw = rawSchema.safeParse(input);
  if (raw.success) return { data: normaliser(raw.data), state: "ready" };
  const parsed = schema.safeParse(input);
  if (!parsed.success) return { data: null, state: "invalid" };
  return { data: parsed.data as Referentiel, state: "ready" };
}
/** Référentiel calculé par le worker pour un artiste suivi (table `artist_referentials`). */
async function charger(artistId: string): Promise<ReferentielResult> {
  const { data, error } = await supabase()
    .from("artist_referentials")
    .select("data, built_at")
    .eq("org_artist_id", artistId)
    .maybeSingle();
  if (error) return { data: null, state: "unavailable" };
  if (!data) return { data: null, state: "missing" };
  return parseReferentiel((data as { data: unknown }).data);
}
export const referentielQuery = (artistId: string) =>
  queryOptions({
    queryKey: ["referentiel", artistId],
    queryFn: () => charger(artistId),
    staleTime: 0,
    refetchOnMount: "always",
    retry: false,
  });
/** Sources de la matrice : les quatre historiques d’abord, puis les autres (imports…). */
export function sourcesMatrice(data: Referentiel | null): string[] {
  const noms = new Set<string>(SOURCES);
  for (const s of data?.meta.sources ?? []) noms.add(s.name);
  for (const row of data?.matrix ?? []) for (const name of Object.keys(row.values)) noms.add(name);
  return [...noms];
}
export function sourceInfo(data: Referentiel | null, name: string): Source | undefined {
  return data?.meta.sources?.find((s) => s.name.toLowerCase() === name.toLowerCase());
}
export function plateformes(
  data: Referentiel | null,
): { node: Node; edge: Edge; url: string | null; category: string }[] {
  if (!data) return [];
  return data.nodes
    .filter((n) => n.type === "platform")
    .flatMap((node) => {
      const edge = data.edges.find(
        (e) =>
          (e.target === node.id &&
            (!data.meta.focus_artist || e.source === data.meta.focus_artist)) ||
          (e.source === node.id &&
            (!data.meta.focus_artist || e.target === data.meta.focus_artist)),
      );
      if (!edge) return [];
      const url = edge.props["url"] ?? edge.props["source_url"];
      return [
        {
          node,
          edge,
          url: typeof url === "string" ? url : null,
          category:
            typeof node.props["category"] === "string" ? node.props["category"] : "reference",
        },
      ];
    });
}

export function sourcesCatalogue(data: Referentiel | null, type: string): Source[] {
  const byProvenance = new Map<string, Source>();
  for (const node of data?.nodes ?? []) {
    if (node.type !== type) continue;
    for (const source of node.sources ?? [])
      byProvenance.set(`${source.name}|${source.source_url}`, source);
  }
  // A catalog total aggregates these source datasets, not the artist identity records.
  return [...byProvenance.values()].filter(
    (s, index, all) => all.findIndex((other) => other.name === s.name) === index,
  );
}
