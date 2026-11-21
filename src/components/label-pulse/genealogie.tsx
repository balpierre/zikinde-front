import { useEffect, useRef, useState } from "react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  CircleAlert,
  Disc3,
  FileMusic,
  Globe2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { SourceBadges } from "./shared";
import {
  anomaliesEnregistrement,
  genealogieProjection,
  oeuvreSelectionnee,
  type CarteGenealogie,
  type ConnexionGenealogie,
} from "@/lib/genealogie";
import type { Referentiel } from "@/lib/referentiel";
import {
  dateObjet,
  droits,
  gravites,
  nombre,
  regleFr,
  statutsSource,
  typesNoeuds,
  typesSorties,
} from "@/lib/libelles";

const columnInfo = [
  { name: "Œuvre", type: "work", code: "ISWC", Icon: FileMusic },
  { name: "Enregistrements", type: "recording", code: "ISRC", Icon: AudioLines },
  { name: "Sorties", type: "release", code: "UPC", Icon: Disc3 },
  { name: "Plateformes", type: "platform", code: "", Icon: Globe2 },
];
function Connecteurs({
  container,
  connections,
}: {
  container: React.RefObject<HTMLDivElement | null>;
  connections: ConnexionGenealogie[];
}) {
  const [paths, setPaths] = useState<
    { key: string; d: string; inferred: boolean; label: string }[]
  >([]);
  useEffect(() => {
    const graph = container.current;
    if (!graph) return;
    const measure = () => {
      const bounds = graph.getBoundingClientRect();
      const cards = Array.from(graph.querySelectorAll<HTMLElement>("[data-genealogy-key]"));
      setPaths(
        connections.flatMap((c) => {
          const start = cards
            .find((card) => card.dataset["genealogyKey"] === c.from)
            ?.getBoundingClientRect();
          const end = cards
            .find((card) => card.dataset["genealogyKey"] === c.to)
            ?.getBoundingClientRect();
          if (!start || !end) return [];
          const x1 = start.right - bounds.left,
            y1 = start.top + start.height / 2 - bounds.top;
          const x2 = end.left - bounds.left,
            y2 = end.top + end.height / 2 - bounds.top;
          const mid = (x1 + x2) / 2;
          return [
            {
              key: c.key,
              d: `M ${x1} ${y1} C ${mid} ${y1}, ${mid} ${y2}, ${x2} ${y2}`,
              inferred: c.edge.basis === "inferred",
              label: c.edge.label,
            },
          ];
        }),
      );
    };
    const observer = new ResizeObserver(measure);
    observer.observe(graph);
    graph.querySelectorAll("[data-genealogy-key]").forEach((card) => observer.observe(card));
    measure();
    return () => observer.disconnect();
  }, [container, connections]);
  return (
    <svg className="genealogy-connectors" aria-hidden="true">
      {paths.map((path) => (
        <path
          key={path.key}
          d={path.d}
          className={path.inferred ? "connection-inferred" : "connection-declared"}
        >
          <title>
            {path.label}
            {path.inferred ? " · inférée" : ""}
          </title>
        </path>
      ))}
    </svg>
  );
}
function Carte({
  item,
  data,
  onAnomaly,
}: {
  item: CarteGenealogie;
  data: Referentiel;
  onAnomaly: (id: string) => void;
}) {
  const { node, edge } = item;
  const info = columnInfo.find((c) => c.type === node.type);
  const Icon = info?.Icon ?? Globe2;
  const identifier =
    node.props[node.type === "work" ? "iswc" : node.type === "recording" ? "isrc" : "upc"];
  const releaseType = node.props["release_type"];
  const type =
    node.type === "release" && typeof releaseType === "string"
      ? `Sortie · ${typesSorties[releaseType] ?? "Type non renseigné"}`
      : (typesNoeuds[node.type] ?? "Objet");
  const date = node.props["release_date"] ?? node.props["date"];
  const warnings = node.type === "recording" ? anomaliesEnregistrement(data, node) : [];
  const relations = data.edges.filter((e) => e.source === node.id && e.target.startsWith("work:"));
  return (
    <article
      className={`genealogy-card ${node.type === "platform" ? "release" : node.type === "work" ? "work" : node.type === "recording" ? "recording" : "release"}`}
      data-genealogy-key={item.key}
      aria-label={`${typesNoeuds[node.type]} · ${node.label}`}
    >
      <div className="genealogy-card-kind">
        <Icon size={15} />
        <span>{type}</span>
      </div>
      <h3>{node.label}</h3>
      {node.type !== "platform" && (
        <div className="genealogy-identifier">
          <span>{info?.code}</span>
          <strong>{typeof identifier === "string" ? identifier : "Non renseigné"}</strong>
        </div>
      )}
      <div className="genealogy-date">{dateObjet(typeof date === "string" ? date : undefined)}</div>
      {node.type === "recording" &&
        relations
          .filter((e) => e.basis === "inferred")
          .map((relation) => (
            <Tooltip key={relation.id}>
              <TooltipTrigger asChild>
                <span className="genealogy-inferred" tabIndex={0}>
                  {relation.label} · inférée
                </span>
              </TooltipTrigger>
              <TooltipContent>{regleFr(relation.rule ?? "Règle non renseignée")}</TooltipContent>
            </Tooltip>
          ))}
      {edge && <span className="genealogy-relation">{edge.label}</span>}
      <SourceBadges sources={edge?.sources ?? node.sources ?? []} />
      {item.url && /^https?:\/\//.test(item.url) && (
        <Button variant="link" asChild className="genealogy-platform-link">
          <a href={item.url} target="_blank" rel="noreferrer">
            Ouvrir la sortie
            <ArrowUpRight />
          </a>
        </Button>
      )}
      {warnings.length > 0 && (
        <div className="genealogy-alerts">
          {warnings.map((anomaly) => (
            <Tooltip key={anomaly.id}>
              <TooltipTrigger asChild>
                <Button
                  size="sm"
                  variant="outline"
                  className="genealogy-alert"
                  onClick={() => onAnomaly(anomaly.id)}
                  aria-label={`Voir l’anomalie ${anomaly.id} pour ${String(identifier)}`}
                >
                  <CircleAlert />
                  {anomaly.id}
                </Button>
              </TooltipTrigger>
              <TooltipContent>{anomaly.label}</TooltipContent>
            </Tooltip>
          ))}
        </div>
      )}
    </article>
  );
}
export function Genealogie({
  data,
  selectedWork,
  selectedAnomaly,
  onSelect,
  onAnomaly,
  onOpenAnomaly,
}: {
  data: Referentiel;
  selectedWork: string | undefined;
  selectedAnomaly: string | undefined;
  onSelect: (id: string) => void;
  onAnomaly: (id?: string) => void;
  onOpenAnomaly?: (id: string) => void;
}) {
  const selected = oeuvreSelectionnee(data, selectedWork);
  const graphRef = useRef<HTMLDivElement>(null);
  const projection = selected ? genealogieProjection(data, selected) : null;
  const anomaly = data.anomalies.find((a) => a.id === selectedAnomaly);
  if (!selected || !projection)
    return (
      <div className="section-empty">
        <GitEmpty />
        Aucune généalogie documentée pour cet artiste.
      </div>
    );
  return (
    <section
      className="genealogy-section"
      role="tabpanel"
      id="genealogy-panel"
      aria-label="Généalogie"
    >
      <div className="genealogy-layout">
        <aside className="genealogy-sidebar">
          <div className="genealogy-sidebar-title">
            <h2>Œuvres</h2>
            <span className="mono">{nombre(data.genealogies.length)}</span>
          </div>
          <div className="genealogy-work-list">
            {data.genealogies.map((work) => (
              <Button
                key={work.id}
                variant="ghost"
                className={`genealogy-work-option ${work.id === selected.id ? "selected" : ""}`}
                aria-pressed={work.id === selected.id}
                onClick={() => onSelect(work.id)}
              >
                <FileMusic />
                <span>{work.label}</span>
                {work.id === selected.id && <ArrowRight />}
              </Button>
            ))}
          </div>
        </aside>
        <div className="genealogy-main">
          <div className="genealogy-heading">
            <div>
              <span className="eyebrow">TRAJECTOIRE DE L’ŒUVRE</span>
              <h2>{selected.label}</h2>
            </div>
            <span className="section-detail">
              {nombre(projection.columns[1]?.length)} enregistrements ·{" "}
              {nombre(projection.columns[2]?.length)} sorties
            </span>
          </div>
          <div
            className="genealogy-scroll"
            tabIndex={0}
            role="region"
            aria-label="Généalogie horizontale à quatre colonnes"
          >
            <div className="genealogy-graph" ref={graphRef}>
              <Connecteurs container={graphRef} connections={projection.connections} />
              {columnInfo.map(({ name, type, code, Icon }, index) => (
                <div
                  className={`genealogy-column ${type === "work" ? "work" : type === "recording" ? "recording" : "release"}`}
                  key={type}
                >
                  <div className="genealogy-column-heading">
                    <Icon size={17} />
                    <h3>{name}</h3>
                    <span className="mono">{code}</span>
                  </div>
                  <div className="genealogy-column-cards">
                    {projection.columns[index]?.map((item) => (
                      <Carte key={item.key} item={item} data={data} onAnomaly={onAnomaly} />
                    ))}
                    {!projection.columns[index]?.length && (
                      <p className="genealogy-no-object">Aucun objet documenté</p>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
          <div className="genealogy-lines-legend">
            <span>
              <i className="solid-line" />
              Relation déclarée
            </span>
            <span>
              <i className="dashed-line" />
              Relation inférée
            </span>
            <span>
              <CircleAlert size={12} />
              Anomalie liée à l’ISRC
            </span>
          </div>
        </div>
      </div>
      <section className="genealogy-rights" aria-label="Légende des objets et de leurs droits">
        <h2>Trois objets, trois cadres de droits</h2>
        <div className="genealogy-rights-grid">
          {columnInfo.slice(0, 3).map(({ name, type, code, Icon }) => (
            <div
              className={`genealogy-right ${type === "work" ? "work" : type === "recording" ? "recording" : "release"}`}
              key={type}
            >
              <Icon size={20} />
              <div>
                <h3>
                  {name} <span className="mono">{code}</span>
                </h3>
                <strong>{droits[type]}</strong>
                <p>
                  {type === "work"
                    ? "La composition et les paroles."
                    : type === "recording"
                      ? "L’interprétation fixée sur un enregistrement."
                      : "L’édition commercialisée et distribuée."}
                </p>
              </div>
            </div>
          ))}
        </div>
      </section>
      <Dialog
        open={Boolean(anomaly)}
        onOpenChange={(open) => {
          if (!open) onAnomaly();
        }}
      >
        <DialogContent className="genealogy-anomaly-dialog">
          <DialogHeader>
            <span className="eyebrow">
              ANOMALIE {anomaly?.id} ·{" "}
              {(statutsSource[anomaly?.status ?? ""] ?? "Statut non renseigné").toUpperCase()}
            </span>
            <DialogTitle>{anomaly?.label}</DialogTitle>
            <DialogDescription>
              {anomaly?.description ?? "Aucun détail complémentaire renseigné."}
            </DialogDescription>
          </DialogHeader>
          {anomaly?.severity && (
            <p className="anomaly-severity">
              Gravité : {gravites[anomaly.severity] ?? "non renseignée"}
            </p>
          )}
          <SourceBadges sources={anomaly?.sources ?? []} />
          {anomaly?.suggested_action && (
            <section className="anomaly-action">
              <h3>Action suggérée</h3>
              <p>{anomaly.suggested_action}</p>
            </section>
          )}
          {anomaly && onOpenAnomaly && (
            <Button variant="outline" onClick={() => onOpenAnomaly(anomaly.id)}>
              Traiter dans l’onglet Anomalies
              <ArrowRight />
            </Button>
          )}
        </DialogContent>
      </Dialog>
    </section>
  );
}
function GitEmpty() {
  return <FileMusic size={20} />;
}
