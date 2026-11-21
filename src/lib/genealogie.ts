import type { Anomaly, Edge, Genealogy, Node, Referentiel } from "./referentiel";

export function oeuvreSelectionnee(data: Referentiel, id?: string): Genealogy | undefined {
  return (
    data.genealogies.find((g) => g.id === id) ??
    data.genealogies.find((g) => g.id === "work:over-and-done") ??
    data.genealogies[0]
  );
}
export function anomaliesEnregistrement(data: Referentiel, node: Node): Anomaly[] {
  const isrc = node.props["isrc"];
  if (typeof isrc !== "string" || !isrc) return [];
  return data.anomalies.filter((a) =>
    a.items?.some((item) =>
      Object.entries(item).some(([key, value]) => /^isrc(?:_.*)?$/.test(key) && value === isrc),
    ),
  );
}
export interface CarteGenealogie {
  key: string;
  node: Node;
  edge?: Edge;
  url?: string;
}
export interface ConnexionGenealogie {
  key: string;
  from: string;
  to: string;
  edge: Edge;
}
export function genealogieProjection(data: Referentiel, genealogy: Genealogy) {
  const nodes = data.nodes.filter((n) => genealogy.node_ids.includes(n.id));
  const work = nodes.find((n) => n.type === "work");
  const recordings = nodes.filter((n) => n.type === "recording");
  const releases = nodes.filter((n) => n.type === "release");
  const columns: CarteGenealogie[][] = [
    work ? [{ key: work.id, node: work }] : [],
    recordings.map((node) => ({ key: node.id, node })),
    releases.map((node) => ({ key: node.id, node })),
    [],
  ];
  const connections: ConnexionGenealogie[] = [];
  for (const edge of data.edges) {
    if (work && edge.target === work.id && recordings.some((n) => n.id === edge.source))
      connections.push({ key: edge.id, from: work.id, to: edge.source, edge });
    if (releases.some((n) => n.id === edge.source) && recordings.some((n) => n.id === edge.target))
      connections.push({ key: edge.id, from: edge.target, to: edge.source, edge });
    if (!releases.some((n) => n.id === edge.source)) continue;
    const platform = data.nodes.find((n) => n.id === edge.target && n.type === "platform");
    if (!platform) continue;
    const url = edge.props["url"];
    const key = `${edge.source}|${platform.id}`;
    columns[3]?.push({ key, node: platform, edge, ...(typeof url === "string" ? { url } : {}) });
    connections.push({ key: edge.id, from: edge.source, to: key, edge });
  }
  return { columns, connections };
}
