import type { Claim, Edge, Node, Referentiel, Source } from "./referentiel";
import { libelleSansLabel } from "./libelles";

export const typesGraphe = [
  "artist",
  "work",
  "group",
  "label",
  "platform",
  "recording",
  "release",
  "person",
] as const;
export const typesParDefaut: string[] = [
  "artist",
  "work",
  "group",
  "label",
  "platform",
  "recording",
];
export function selectionGraphe(
  data: Referentiel,
  types: readonly string[] = typesParDefaut,
  inferred = false,
) {
  const focus =
    data.meta.focus_artist ??
    data.nodes.find((n) => n.props["focus"] === true)?.id ??
    "artist:senbei";
  const nearby = new Set(
    data.edges
      .filter((e) => e.type === "related_to" && (e.source === focus || e.target === focus))
      .map((e) => (e.source === focus ? e.target : e.source)),
  );
  const topRecordings = data.nodes
    .filter((n) => n.type === "recording" && typeof n.props["deezer_rank"] === "number")
    .sort(
      (a, b) =>
        Number(b.props["deezer_rank"]) - Number(a.props["deezer_rank"]) || a.id.localeCompare(b.id),
    )
    .slice(0, 20);
  const ranked = new Set(topRecordings.map((n) => n.id));
  // The focus artist stays at the center; the artist filter only controls nearby artists.
  const base = data.nodes.filter((n) =>
    n.id === focus
      ? true
      : types.includes(n.type) &&
        n.type !== "release" &&
        (n.type === "artist" ? nearby.has(n.id) : n.type === "recording" ? ranked.has(n.id) : true),
  );
  const baseIds = new Set(base.map((n) => n.id));
  // Labels and platforms would pull in the whole discography: releases follow shown recordings and persons.
  const typeDe = new Map(data.nodes.map((n) => [n.id, n.type]));
  const ancree = (id: string) =>
    baseIds.has(id) && ["recording", "person"].includes(typeDe.get(id) ?? "");
  const releaseIds = new Set(
    types.includes("release")
      ? data.edges.flatMap((e) =>
          ancree(e.target) && typeDe.get(e.source) === "release"
            ? [e.source]
            : ancree(e.source) && typeDe.get(e.target) === "release"
              ? [e.target]
              : [],
        )
      : [],
  );
  const nodes = [...base, ...data.nodes.filter((n) => releaseIds.has(n.id))];
  const ids = new Set(nodes.map((n) => n.id));
  const visibles = data.edges.filter((e) => ids.has(e.source) && ids.has(e.target));
  const edges: AreteGraphe[] = [
    ...visibles.filter((e) => inferred || e.basis !== "inferred"),
    ...relationsViaSorties(data, focus).filter((e) => ids.has(e.target)),
  ];
  const inferees = visibles.filter((e) => e.basis === "inferred").length;
  return { focus, nodes, edges, topRecordings, inferees };
}
export const SANS_LABEL = "label:sans-label";
const pseudoLabels = new Set(["[no label]", "not on label"]);
// Sources encode "no label" as label records; the graph shows one explicit absence instead.
export function fusionnerSansLabel(data: Referentiel): Referentiel {
  const pseudo = new Set(
    data.nodes
      .filter((n) => n.type === "label" && pseudoLabels.has(n.label.trim().toLowerCase()))
      .map((n) => n.id),
  );
  if (!pseudo.size) return data;
  const vers = (id: string) => (pseudo.has(id) ? SANS_LABEL : id);
  const unique = (sources: Source[]) => [
    ...new Map(sources.map((s) => [`${s.name}|${s.source_url}`, s])).values(),
  ];
  const fusion: Node = {
    id: SANS_LABEL,
    type: "label",
    label: libelleSansLabel,
    props: {},
    sources: unique(data.nodes.filter((n) => pseudo.has(n.id)).flatMap((n) => n.sources ?? [])),
  };
  const edges = new Map<string, Edge>();
  for (const edge of data.edges) {
    if (!pseudo.has(edge.source) && !pseudo.has(edge.target)) {
      edges.set(edge.id, edge);
      continue;
    }
    const source = vers(edge.source),
      target = vers(edge.target);
    const id = `${source}|${edge.type}|${target}`;
    const existing = edges.get(id);
    // A declared edge wins over an inferred duplicate so the merge never hides a declared link.
    const base = existing?.basis === "declared" ? existing : edge;
    edges.set(id, {
      ...base,
      id,
      source,
      target,
      sources: unique([...(existing?.sources ?? []), ...(edge.sources ?? [])]),
    });
  }
  // Graph-only view: genealogies and anomalies keep the original label records.
  return {
    ...data,
    nodes: [...data.nodes.filter((n) => !pseudo.has(n.id)), fusion],
    edges: [...edges.values()],
    claims: data.claims.map((c) => (pseudo.has(c.node_id) ? { ...c, node_id: SANS_LABEL } : c)),
  };
}
export interface AreteGraphe extends Edge {
  via?: string[];
}
// Shortcut of explicit paths focus → release → label, never an inference.
export function relationsViaSorties(data: Referentiel, focus: string): AreteGraphe[] {
  const types = new Map(data.nodes.map((n) => [n.id, n.type]));
  const participations = data.edges.filter(
    (e) => e.source === focus && types.get(e.target) === "release" && e.basis !== "inferred",
  );
  const sorties = new Set(participations.map((e) => e.target));
  const parLabel = new Map<string, Edge[]>();
  for (const edge of data.edges)
    if (
      edge.type === "released_by" &&
      sorties.has(edge.source) &&
      types.get(edge.target) === "label"
    )
      parLabel.set(edge.target, [...(parLabel.get(edge.target) ?? []), edge]);
  return [...parLabel].map(([label, publications]) => {
    const via = [...new Set(publications.map((e) => e.source))].sort();
    const chemin = [...participations.filter((e) => via.includes(e.target)), ...publications];
    const sources = new Map<string, Source>();
    for (const source of chemin.flatMap((e) => e.sources ?? []))
      sources.set(`${source.name}|${source.source_url}`, source);
    return {
      id: `via-sorties|${focus}|${label}`,
      source: focus,
      target: label,
      type: "via_releases",
      label: label === SANS_LABEL ? "sans_label" : "via_sorties",
      basis: "declared",
      props: { nombre_sorties: via.length },
      sources: [...sources.values()],
      via,
    };
  });
}
function valeurCanonique(field: string, value: Claim["value"]): string {
  const normalize = (v: string) => {
    const normalized = v
      .normalize("NFD")
      .replace(/[\u0300-\u036f]/g, "")
      .toLowerCase()
      .trim();
    if (field === "pays" && ["fr", "france"].includes(normalized)) return "france";
    if (field === "genres") return normalized.replace(/[-\s]+/g, "");
    return normalized;
  };
  return JSON.stringify(
    Array.isArray(value)
      ? value.map(normalize).sort()
      : typeof value === "string"
        ? normalize(value)
        : value,
  );
}
export type EtatAffirmations = "concordant" | "mineur" | "divergent";
export const ECART_DUREE_MINEUR_S = 2;
const estIdentifiant = (field: string) =>
  ["isrc", "iswc", "upc", "isni", "barcode"].includes(field) || field.startsWith("id_");
// A minor gap stays visible but is not an alert: rounding between sources or title punctuation.
export function etatAffirmations(field: string, claims: Claim[]): EtatAffirmations {
  const brutes = (list: Claim[]) =>
    new Set(list.map((c) => JSON.stringify(Array.isArray(c.value) ? [...c.value].sort() : c.value)))
      .size;
  // One record giving two values is a matching defect; two records of one platform are compared normally.
  const parFiche = new Map<string, Claim[]>();
  for (const claim of claims)
    for (const source of claim.sources) {
      const fiche = `${source.name}|${source.source_url}`;
      parFiche.set(fiche, [...(parFiche.get(fiche) ?? []), claim]);
    }
  if ([...parFiche.values()].some((list) => brutes(list) > 1)) return "divergent";
  if (brutes(claims) <= 1) return "concordant";
  if (estIdentifiant(field)) return "divergent";
  const values = claims.map((c) => c.value);
  if (["duree_s", "duration_s"].includes(field) && values.every((v) => typeof v === "number")) {
    const numbers = values as number[];
    const ecart = Math.max(...numbers) - Math.min(...numbers);
    return ecart <= ECART_DUREE_MINEUR_S ? "mineur" : "divergent";
  }
  const canoniques = new Set(values.map((v) => valeurCanonique(field, v)));
  if (canoniques.size <= 1) return field === "titre" ? "mineur" : "concordant";
  if (
    field === "titre" &&
    new Set([...canoniques].map((v) => v.replace(/[^\p{L}\p{N}]/gu, ""))).size <= 1
  )
    return "mineur";
  return "divergent";
}
export function affirmationsGroupees(data: Referentiel, id: string) {
  const fields = new Map<string, Claim[]>();
  for (const claim of data.claims.filter((c) => c.node_id === id))
    fields.set(claim.field, [...(fields.get(claim.field) ?? []), claim]);
  return [...fields].map(([field, claims]) => ({
    field,
    claims,
    etat: etatAffirmations(field, claims),
  }));
}
export function positionsGraphe(nodes: Node[], focus: string) {
  const rings = [
    nodes.filter((n) => n.id !== focus && ["work", "group", "label"].includes(n.type)),
    nodes.filter((n) => n.type === "recording"),
    nodes.filter(
      (n) => n.id !== focus && !["work", "group", "label", "recording"].includes(n.type),
    ),
  ];
  const positions = new Map<string, { x: number; y: number }>([[focus, { x: 0, y: 0 }]]);
  rings.forEach((ring, index) =>
    ring.forEach((node, i) => {
      const radius = [235, 410, 590][index] ?? 590;
      const angle = (i / Math.max(ring.length, 1)) * 2 * Math.PI - Math.PI / 2 + index * 0.17;
      positions.set(node.id, { x: Math.cos(angle) * radius, y: Math.sin(angle) * radius });
    }),
  );
  return positions;
}
