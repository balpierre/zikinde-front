import { useEffect, useMemo, useRef, useState } from "react";
import type { Core, ElementDefinition } from "cytoscape";
import { CircleAlert, Focus, Minus, Network, Plus, RotateCcw, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { SourceBadges } from "./shared";
import {
  affirmationsGroupees,
  positionsGraphe,
  fusionnerSansLabel,
  relationsViaSorties,
  SANS_LABEL,
  selectionGraphe,
  typesGraphe,
  typesFiltres,
  typesParDefaut,
  type AreteGraphe,
} from "@/lib/graphe";
import {
  bases,
  libelleChamp,
  libelleArtistesProches,
  libelleRelation,
  libelleRelationEntrante,
  nombre,
  proprieteFr,
  regleFr,
  typesNoeuds,
} from "@/lib/libelles";
import type { Node, Referentiel } from "@/lib/referentiel";

// Canvas translates CSS theme tokens to colors supported by Cytoscape, never a second palette.
function tokenCouleur(element: HTMLElement, token: string): string {
  const canvas = document.createElement("canvas");
  canvas.width = 1;
  canvas.height = 1;
  const context = canvas.getContext("2d");
  const value = getComputedStyle(element).getPropertyValue(token).trim();
  if (!context) return value;
  context.fillStyle = value;
  context.fillRect(0, 0, 1, 1);
  const pixel = context.getImageData(0, 0, 1, 1).data;
  return `rgb(${pixel[0]}, ${pixel[1]}, ${pixel[2]})`;
}
const RELATIONS_AFFICHEES = 5;
// The focus artist is always shown: this filter only controls nearby artists.
const libelleFiltre = (type: string) =>
  type === "artist" ? libelleArtistesProches : (typesNoeuds[type] ?? type);
function DetailNoeud({
  node,
  data,
  noeuds,
  aretes,
  visibles,
  onSelect,
  onClose,
}: {
  node: Node;
  data: Referentiel;
  noeuds: Map<string, Node>;
  aretes: AreteGraphe[];
  visibles: Set<string>;
  onSelect: (id: string) => void;
  onClose: () => void;
}) {
  const [ouverts, setOuverts] = useState<Set<string>>(new Set());
  const affirmations = affirmationsGroupees(data, node.id);
  const relations = aretes.filter((e) => e.source === node.id || e.target === node.id);
  const groupesRelations = [
    ...relations
      .reduce((map, edge) => {
        const libelle = libelleRelation(edge.type, edge.label);
        const entrante = edge.source !== node.id;
        const cle = `${entrante ? "in" : "out"}|${libelle}`;
        const groupe = map.get(cle) ?? {
          titre: entrante ? `${libelle} · ${libelleRelationEntrante}` : libelle,
          aretes: [],
        };
        groupe.aretes.push(edge);
        return map.set(cle, groupe);
      }, new Map<string, { titre: string; aretes: AreteGraphe[] }>())
      .entries(),
  ];
  return (
    <aside className="graph-detail" aria-label={`Détail de ${node.label}`}>
      <div className="graph-detail-header">
        <div>
          <span className={`graph-type-mark type-${node.type}`} />
          <span>{typesNoeuds[node.type]}</span>
          {!visibles.has(node.id) && <span className="graph-hidden">hors de la vue</span>}
        </div>
        <Button size="icon" variant="ghost" onClick={onClose} aria-label="Fermer le détail">
          <X />
        </Button>
      </div>
      <h2>{node.label}</h2>
      <SourceBadges sources={node.sources ?? []} />
      <section>
        <h3>Propriétés</h3>
        {Object.keys(node.props).length ? (
          <dl className="graph-properties">
            {Object.entries(node.props).map(([field, value]) => (
              <div key={field}>
                <dt>{libelleChamp(field)}</dt>
                <dd>
                  {typeof value === "string" && /^https?:\/\//.test(value) ? (
                    <a href={value} target="_blank" rel="noreferrer">
                      Ouvrir le lien
                    </a>
                  ) : (
                    proprieteFr(field, value)
                  )}
                </dd>
              </div>
            ))}
          </dl>
        ) : (
          <p className="graph-detail-empty">Aucune propriété renseignée.</p>
        )}
      </section>
      <section>
        <h3>
          Affirmations <span>{nombre(affirmations.length)} champs</span>
        </h3>
        {affirmations.length ? (
          affirmations.map((group) => (
            <div className={`graph-claim-group claim-${group.etat}`} key={group.field}>
              <h4>
                {libelleChamp(group.field)}
                {group.etat === "divergent" && (
                  <span>
                    <CircleAlert size={12} />
                    Divergent
                  </span>
                )}
                {group.etat === "mineur" && (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span tabIndex={0}>Écart mineur</span>
                    </TooltipTrigger>
                    <TooltipContent>
                      Arrondi de durée ou ponctuation du titre : les sources concordent sur le fond.
                    </TooltipContent>
                  </Tooltip>
                )}
              </h4>
              {group.claims.map((claim) => (
                <div className="graph-claim" key={claim.id}>
                  <p>{proprieteFr(group.field, claim.value)}</p>
                  <SourceBadges sources={claim.sources} />
                </div>
              ))}
            </div>
          ))
        ) : (
          <p className="graph-detail-empty">Aucune affirmation documentée.</p>
        )}
      </section>
      <section>
        <h3>
          Relations <span>{nombre(relations.length)}</span>
        </h3>
        {groupesRelations.length ? (
          groupesRelations.map(([cle, { titre, aretes }]) => (
            <div className="graph-relation-group" key={cle}>
              <h4>
                {titre} <span>{nombre(aretes.length)}</span>
              </h4>
              {(ouverts.has(cle) ? aretes : aretes.slice(0, RELATIONS_AFFICHEES)).map((edge) => (
                <Relation
                  key={edge.id}
                  edge={edge}
                  node={node}
                  noeuds={noeuds}
                  visibles={visibles}
                  onSelect={onSelect}
                />
              ))}
              {aretes.length > RELATIONS_AFFICHEES && (
                <Button
                  variant="link"
                  className="graph-relation-more"
                  onClick={() =>
                    setOuverts((previous) => {
                      const next = new Set(previous);
                      if (next.has(cle)) next.delete(cle);
                      else next.add(cle);
                      return next;
                    })
                  }
                >
                  {ouverts.has(cle) ? "Réduire" : `Tout afficher (${nombre(aretes.length)})`}
                </Button>
              )}
            </div>
          ))
        ) : (
          <p className="graph-detail-empty">Aucune relation documentée.</p>
        )}
      </section>
    </aside>
  );
}
function Relation({
  edge,
  node,
  noeuds,
  visibles,
  onSelect,
}: {
  edge: AreteGraphe;
  node: Node;
  noeuds: Map<string, Node>;
  visibles: Set<string>;
  onSelect: (id: string) => void;
}) {
  const [ouvert, setOuvert] = useState(false);
  const targetId = edge.source === node.id ? edge.target : edge.source;
  const target = noeuds.get(targetId);
  const sorties = (edge.via ?? [])
    .flatMap((id) => noeuds.get(id) ?? [])
    .sort((a, b) => a.label.localeCompare(b.label, "fr"));
  return (
    <div className="graph-relation">
      <Button variant="link" onClick={() => onSelect(targetId)}>
        {target?.label ?? "Objet non renseigné"}
      </Button>
      {!visibles.has(targetId) && <span className="graph-hidden">hors de la vue</span>}
      {edge.via ? (
        <Tooltip>
          <TooltipTrigger asChild>
            <span className="graph-via" tabIndex={0}>
              {nombre(edge.via.length)} sortie{edge.via.length > 1 ? "s" : ""}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            Raccourci des relations déclarées artiste → sortie → label.
          </TooltipContent>
        </Tooltip>
      ) : (
        <Tooltip>
          <TooltipTrigger asChild>
            <span
              className={edge.basis === "inferred" ? "graph-inferred" : "graph-declared"}
              tabIndex={0}
            >
              {bases[edge.basis ?? "declared"]}
            </span>
          </TooltipTrigger>
          <TooltipContent>
            {edge.basis === "inferred"
              ? regleFr(edge.rule ?? "Règle non renseignée")
              : "Relation déclarée par une source."}
          </TooltipContent>
        </Tooltip>
      )}
      {sorties.length > 0 && (
        <div className="graph-via-list">
          {(ouvert ? sorties : sorties.slice(0, RELATIONS_AFFICHEES)).map((sortie) => (
            <span key={sortie.id}>
              <Button variant="link" onClick={() => onSelect(sortie.id)}>
                {sortie.label}
              </Button>
              {!visibles.has(sortie.id) && <span className="graph-hidden"> hors de la vue</span>}
            </span>
          ))}
          {sorties.length > RELATIONS_AFFICHEES && (
            <Button
              variant="link"
              className="graph-relation-more"
              onClick={() => setOuvert((previous) => !previous)}
            >
              {ouvert ? "Réduire" : `Tout afficher (${nombre(sorties.length)})`}
            </Button>
          )}
        </div>
      )}
      <SourceBadges sources={edge.sources ?? []} />
    </div>
  );
}
export function Graphe({
  data: referentiel,
  type,
}: {
  data: Referentiel;
  type?: string | undefined;
}) {
  const data = useMemo(() => fusionnerSansLabel(referentiel), [referentiel]);
  const [types, setTypes] = useState<string[]>(() => typesFiltres(type));
  const [inferred, setInferred] = useState(false);
  const [selected, setSelected] = useState<string | null>(null);
  const [ready, setReady] = useState(false);
  const [failed, setFailed] = useState(false);
  const container = useRef<HTMLDivElement>(null);
  const cy = useRef<Core | null>(null);
  const projection = useMemo(() => selectionGraphe(data, types, inferred), [data, types, inferred]);
  const noeuds = useMemo(() => new Map(data.nodes.map((n) => [n.id, n])), [data]);
  const node = selected ? noeuds.get(selected) : undefined;
  const visibles = useMemo(() => new Set(projection.nodes.map((n) => n.id)), [projection]);
  // The panel lists every relation of a node, inferred ones included with their badge and rule.
  const aretesDetail = useMemo<AreteGraphe[]>(
    () => [...data.edges, ...relationsViaSorties(data, projection.focus)],
    [data, projection.focus],
  );
  const cadre = useRef(false);
  // One Cytoscape instance per mount: filters update its elements so zoom and pan survive.
  useEffect(() => {
    let cancelled = false;
    const element = container.current;
    if (!element) return;
    void import("cytoscape")
      .then(({ default: cytoscape }) => {
        if (cancelled) return;
        const text = tokenCouleur(element, "--foreground"),
          background = tokenCouleur(element, "--background"),
          primary = tokenCouleur(element, "--primary"),
          line = tokenCouleur(element, "--graph-edge"),
          via = tokenCouleur(element, "--graph-label"),
          quiet = tokenCouleur(element, "--quiet");
        const core = cytoscape({
          container: element,
          elements: [],
          minZoom: 0.12,
          maxZoom: 3,
          wheelSensitivity: 0.18,
          style: [
            {
              selector: "node",
              style: {
                label: "data(label)",
                width: 22,
                height: 22,
                "font-family": getComputedStyle(element).getPropertyValue("--font-sans").trim(),
                "font-size": 13,
                color: text,
                "text-valign": "bottom",
                "text-margin-y": 7,
                "text-max-width": "110px",
                "text-wrap": "ellipsis",
                "text-background-color": background,
                "text-background-opacity": 0.78,
                "text-background-padding": "3px",
                "border-width": 1,
                "border-color": background,
              },
            },
            ...typesGraphe.map((type) => ({
              selector: `node[type = "${type}"]`,
              style: { "background-color": tokenCouleur(element, `--graph-${type}`) },
            })),
            {
              selector: ".absence-node",
              style: {
                "background-color": background,
                "border-width": 1.5,
                "border-style": "dashed",
                "border-color": quiet,
                color: quiet,
              },
            },
            {
              selector: ".focus-node",
              style: {
                width: 54,
                height: 54,
                "font-size": 21,
                "font-weight": 600,
                "border-width": 4,
                "border-color": primary,
                "background-color": background,
                "text-valign": "center",
                "text-halign": "center",
                "text-margin-y": 0,
              },
            },
            {
              selector: "edge",
              style: {
                width: 1,
                "line-color": line,
                "curve-style": "bezier",
                opacity: 0.48,
                "target-arrow-shape": "triangle",
                "target-arrow-color": line,
                "arrow-scale": 0.6,
              },
            },
            {
              selector: "edge.inferred",
              style: {
                "line-style": "dashed",
                "line-color": primary,
                "target-arrow-color": primary,
                opacity: 0.8,
              },
            },
            {
              selector: "edge.via",
              style: {
                "line-style": "dotted",
                "line-color": via,
                "target-arrow-color": via,
                width: 1.5,
                opacity: 0.75,
              },
            },
            { selector: "node:selected", style: { "border-color": primary, "border-width": 4 } },
          ],
        });
        cy.current = core;
        core.on("tap", "node", (event) => {
          setSelected(String(event.target.id()));
        });
        core.on("tap", (event) => {
          if (event.target === core) setSelected(null);
        });
        const observer = new ResizeObserver(() => core.resize());
        observer.observe(element);
        core.on("destroy", () => observer.disconnect());
        setReady(true);
      })
      .catch(() => {
        if (!cancelled) setFailed(true);
      });
    return () => {
      cancelled = true;
      cy.current?.destroy();
      cy.current = null;
      cadre.current = false;
      setReady(false);
    };
  }, []);
  useEffect(() => {
    const core = cy.current;
    if (!core || !ready) return;
    const positions = positionsGraphe(projection.nodes, projection.focus);
    const elements: ElementDefinition[] = [
      ...projection.nodes.map((n) => ({
        group: "nodes" as const,
        data: { id: n.id, label: n.label, type: n.type },
        position: positions.get(n.id) ?? { x: 0, y: 0 },
        classes:
          n.id === projection.focus ? "focus-node" : n.id === SANS_LABEL ? "absence-node" : "",
      })),
      ...projection.edges.map((e) => ({
        group: "edges" as const,
        data: { id: e.id, source: e.source, target: e.target, label: e.label },
        classes: e.via ? "via" : e.basis === "inferred" ? "inferred" : "",
      })),
    ];
    const ids = new Set(elements.map((e) => e.data.id));
    core.batch(() => {
      core
        .elements()
        .filter((e) => !ids.has(e.id()))
        .remove();
      for (const element of elements) {
        const existing = core.getElementById(element.data.id ?? "");
        // Rings are redistributed on purpose so positions stay deterministic for a given filter set.
        if (!existing.length) core.add(element);
        else if (element.position) existing.position(element.position);
      }
    });
    if (!cadre.current) {
      core.fit(undefined, 50);
      cadre.current = true;
    }
  }, [projection, ready]);
  useEffect(() => {
    const core = cy.current;
    if (!core) return;
    core.nodes().unselect();
    if (selected) core.getElementById(selected).select();
  }, [selected, ready, projection]);
  const select = (id: string) => {
    setSelected(id);
    const core = cy.current;
    const item = core?.getElementById(id);
    if (core && item && item.length) {
      core.nodes().unselect();
      item.select();
    }
  };
  const reset = () => {
    setTypes([...typesParDefaut]);
    setInferred(false);
    setSelected(null);
  };
  return (
    <section className="graph-section" role="tabpanel" id="graph-panel" aria-label="Graphe">
      <div className="graph-heading">
        <div>
          <span className="eyebrow">CARTOGRAPHIE DU CATALOGUE</span>
          <h2>Autour de Senbeï</h2>
        </div>
        <span className="graph-count" aria-live="polite">
          {nombre(projection.nodes.length)} nœuds · {nombre(projection.edges.length)} relations
        </span>
      </div>
      <div className="graph-filters">
        <fieldset>
          <legend>Types de nœuds</legend>
          <div className="graph-type-filters">
            {typesGraphe.map((type) => (
              <label key={type}>
                <Checkbox
                  checked={types.includes(type)}
                  onCheckedChange={(checked) =>
                    setTypes((previous) =>
                      checked ? [...previous, type] : previous.filter((t) => t !== type),
                    )
                  }
                  aria-label={libelleFiltre(type)}
                />
                <span className={`graph-type-mark type-${type}`} />
                {libelleFiltre(type)}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="graph-inference-switch">
          <Switch id="graph-inference" checked={inferred} onCheckedChange={setInferred} />
          <label htmlFor="graph-inference">Afficher les relations inférées</label>
          <span className="graph-inference-count">
            {nombre(projection.inferees)} relation{projection.inferees > 1 ? "s" : ""} inférée
            {projection.inferees > 1 ? "s" : ""}
          </span>
        </div>
      </div>
      <div className={`graph-body ${node ? "with-detail" : ""}`}>
        <div className="graph-stage">
          <div
            className="graph-canvas"
            ref={container}
            role="img"
            aria-label={`Graphe de Senbeï, ${projection.nodes.length} nœuds, ${projection.edges.length} relations`}
            data-ready={ready}
          />
          {!ready && (
            <div className="graph-loading" role="status">
              {failed ? "Le graphe n’a pas pu être chargé." : "Chargement du graphe…"}
            </div>
          )}
          {ready && projection.nodes.length <= 1 && (
            <div className="graph-loading">Aucun autre nœud pour les filtres sélectionnés.</div>
          )}
          <div className="graph-tools">
            {[
              {
                label: "Agrandir le graphe",
                Icon: Plus,
                action: () => {
                  const core = cy.current;
                  if (core)
                    core.zoom({
                      level: core.zoom() * 1.25,
                      renderedPosition: { x: core.width() / 2, y: core.height() / 2 },
                    });
                },
              },
              {
                label: "Réduire le graphe",
                Icon: Minus,
                action: () => {
                  const core = cy.current;
                  if (core)
                    core.zoom({
                      level: core.zoom() / 1.25,
                      renderedPosition: { x: core.width() / 2, y: core.height() / 2 },
                    });
                },
              },
              {
                label: "Ajuster le graphe",
                Icon: Focus,
                action: () => cy.current?.fit(undefined, 50),
              },
              { label: "Réinitialiser les filtres", Icon: RotateCcw, action: reset },
            ].map(({ label, Icon, action }) => (
              <Tooltip key={label}>
                <TooltipTrigger asChild>
                  <Button size="icon" variant="outline" aria-label={label} onClick={action}>
                    <Icon />
                  </Button>
                </TooltipTrigger>
                <TooltipContent>{label}</TooltipContent>
              </Tooltip>
            ))}
          </div>
          <div className="graph-node-selector">
            <Select
              value={selected && visibles.has(selected) ? selected : ""}
              onValueChange={select}
            >
              <SelectTrigger aria-label="Choisir un nœud">
                <SelectValue placeholder="Nœuds du graphe" />
              </SelectTrigger>
              <SelectContent>
                {projection.nodes.map((n) => (
                  <SelectItem key={n.id} value={n.id}>
                    {n.label} · {typesNoeuds[n.type]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="graph-stage-caption">
            <Network size={12} />
            <span>20 enregistrements les plus populaires · indice Deezer</span>
          </div>
        </div>
        {node && (
          <DetailNoeud
            key={node.id}
            node={node}
            data={data}
            noeuds={noeuds}
            aretes={aretesDetail}
            visibles={visibles}
            onSelect={select}
            onClose={() => setSelected(null)}
          />
        )}
      </div>
      <div className="graph-legend" aria-label="Légende du graphe">
        {typesGraphe.map((type) => (
          <span key={type}>
            <i className={`graph-type-mark type-${type}`} />
            {typesNoeuds[type]}
          </span>
        ))}
        <span>
          <i className="solid-line" />
          Relation déclarée
        </span>
        <span>
          <i className="dashed-line" />
          Relation inférée
        </span>
        <span>
          <i className="dotted-line" />
          Relation via sorties
        </span>
      </div>
    </section>
  );
}
