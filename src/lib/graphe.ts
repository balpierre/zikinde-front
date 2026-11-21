import type { Claim, Node, Referentiel } from "./referentiel";

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
  const nodes = data.nodes.filter(
    (n) =>
      types.includes(n.type) &&
      (n.type === "artist"
        ? n.id === focus || nearby.has(n.id)
        : n.type === "recording"
          ? ranked.has(n.id)
          : true),
  );
  const ids = new Set(nodes.map((n) => n.id));
  const edges = data.edges.filter(
    (e) => ids.has(e.source) && ids.has(e.target) && (inferred || e.basis !== "inferred"),
  );
  return { focus, nodes, edges, topRecordings };
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
export function affirmationsGroupees(data: Referentiel, id: string) {
  const fields = new Map<string, Claim[]>();
  for (const claim of data.claims.filter((c) => c.node_id === id))
    fields.set(claim.field, [...(fields.get(claim.field) ?? []), claim]);
  return [...fields].map(([field, claims]) => ({
    field,
    claims,
    divergent: new Set(claims.map((c) => valeurCanonique(field, c.value))).size > 1,
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
