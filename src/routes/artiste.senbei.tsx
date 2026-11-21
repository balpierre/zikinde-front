import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowUpRight,
  AudioLines,
  Layers3,
  GitBranch,
  Network,
  CircleAlert,
  CircleCheck,
  CircleMinus,
  FileMusic,
  Disc3,
  Fingerprint,
} from "lucide-react";
import { Graphe } from "@/components/label-pulse/graphe";
import { Genealogie } from "@/components/label-pulse/genealogie";
import { Anomalies } from "@/components/label-pulse/anomalies";
import { ExportReferentiel } from "@/components/label-pulse/export-referentiel";
import { Jauges } from "@/components/label-pulse/jauges";
import { IsrcDouble } from "@/components/label-pulse/isrc-double";
import { Iceberg } from "@/components/label-pulse/iceberg";
import { ChampDivergent } from "@/components/label-pulse/champ-divergent";
import { useDecisions } from "@/hooks/use-decisions";
import { etatLocal } from "@/lib/anomalies";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import {
  Shell,
  Concepts,
  DataNotice,
  PageError,
  PageNotFound,
  SourceBadges,
  SourceBadge,
  metadata,
} from "@/components/label-pulse/shared";
import {
  SOURCES,
  referentielQuery,
  plateformes,
  sourceInfo,
  sourcesCatalogue,
  type MatrixValue,
} from "@/lib/referentiel";
import { categories, statuts, statutsFermes, nombre, couverture } from "@/lib/libelles";
import {
  getDivergentFields,
  getDuplicateIsrcCases,
  getGauges,
  getIcebergCounts,
} from "@/lib/fiabilite";

interface ArtistSearch {
  vue?: "genealogie" | "graphe" | "anomalies";
  oeuvre?: string;
  anomalie?: string;
  correction?: boolean;
  type?: "recording" | "release";
  entite?: string;
}
export const Route = createFileRoute("/artiste/senbei")({
  validateSearch: (search: Record<string, unknown>): ArtistSearch => ({
    ...(search["vue"] === "genealogie" ||
    search["vue"] === "graphe" ||
    search["vue"] === "anomalies"
      ? { vue: search["vue"] }
      : {}),
    ...(typeof search["oeuvre"] === "string" ? { oeuvre: search["oeuvre"] } : {}),
    ...(typeof search["anomalie"] === "string" ? { anomalie: search["anomalie"] } : {}),
    ...(search["type"] === "recording" || search["type"] === "release"
      ? { type: search["type"] }
      : {}),
    ...(typeof search["entite"] === "string" ? { entite: search["entite"] } : {}),
    ...(search["correction"] === true || search["correction"] === "1" ? { correction: true } : {}),
  }),
  head: () =>
    metadata(
      "Référentiel · Senbeï",
      "Identité, matrice de concordance, présence numérique et couverture ISRC et ISWC de Senbeï.",
    ),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(referentielQuery);
  },
  errorComponent: PageError,
  notFoundComponent: PageNotFound,
  component: Artiste,
});
function Cell({ cell, sourceName }: { cell: MatrixValue | undefined; sourceName: string }) {
  if (!cell || cell.value == null) return <span className="missing-value">—</span>;
  return (
    <div className="matrix-value">
      <span>
        {Array.isArray(cell.value)
          ? cell.value.join(", ")
          : typeof cell.value === "number"
            ? nombre(cell.value)
            : cell.value}
      </span>
      <SourceBadges sources={cell.sources ?? []} />
      {!cell.sources?.length && cell.source_url && (
        <SourceBadge
          source={{
            name: sourceName,
            source_url: cell.source_url,
            ...(cell.collected_at ? { collected_at: cell.collected_at } : {}),
          }}
        />
      )}
    </div>
  );
}
function Artiste() {
  const search = Route.useSearch();
  const navigate = useNavigate({ from: "/artiste/senbei" });
  const genealogyActive = search.vue === "genealogie";
  const graphActive = search.vue === "graphe";
  const anomaliesActive = search.vue === "anomalies";
  const overviewActive = !genealogyActive && !graphActive && !anomaliesActive;
  const { data: result } = useSuspenseQuery(referentielQuery);
  const { data } = result;
  const artist = data?.nodes.find((node) =>
    data.meta.focus_artist ? node.id === data.meta.focus_artist : node.type === "artist",
  );
  const platforms = plateformes(data);
  const divergents = new Map((data ? getDivergentFields(data) : []).map((c) => [c.field, c]));
  const groups = [...new Set(platforms.map((p) => categories[p.category] ?? "Référentiel"))];
  const sourceOpen = data?.anomalies.filter((a) => !statutsFermes.includes(a.status));
  const openAnomalies = sourceOpen?.length;
  const { decisions, modifier, persistant } = useDecisions(data?.meta.focus_artist ?? "senbei");
  // Local decisions never close a source anomaly: they are counted apart.
  const handled = sourceOpen?.filter((a) => etatLocal(decisions[a.id]) !== "a_traiter").length ?? 0;
  return (
    <Shell active="reference">
      <main className="content-page artist-page">
        <Button asChild variant="link" className="back-link">
          <Link to="/">
            <ArrowLeft />
            Recherche
          </Link>
        </Button>
        <div className="identity-heading">
          <span className="identity-avatar">
            <AudioLines size={40} strokeWidth={1} />
          </span>
          <div className="identity-body">
            <div className="eyebrow">RÉFÉRENTIEL ARTISTE</div>
            <h1>
              {data?.meta.artist_name ?? artist?.label ?? "Senbeï"}
              <span className="heading-dot">.</span>
            </h1>
            <p>{data?.meta.description ?? "Identité et catalogue en attente de vérification"}</p>
            <SourceBadges sources={artist?.sources ?? []} />
            <div className="genre-list">
              {data?.meta.genres?.map((genre) => (
                <span key={genre}>{genre}</span>
              ))}
            </div>
          </div>
          <div className="identity-aside">
            <div className="identity-state">
              <CircleAlert size={15} />
              {openAnomalies == null
                ? "Anomalies non renseignées"
                : `${nombre(openAnomalies)} anomalie${openAnomalies > 1 ? "s" : ""} ouverte${openAnomalies > 1 ? "s" : ""}${handled ? ` · dont ${nombre(handled)} traitée${handled > 1 ? "s" : ""} localement` : ""}`}
            </div>
            {data && <ExportReferentiel data={data} />}
          </div>
        </div>
        {data && <Jauges jauges={getGauges(data)} />}
        <Concepts compact />
        <div className="artist-tabs" role="tablist" aria-label="Vues du référentiel">
          <Button
            variant="ghost"
            role="tab"
            aria-selected={overviewActive}
            className={overviewActive ? "active-tab" : ""}
            onClick={() => void navigate({ search: {} })}
          >
            <Layers3 />
            Vue d’ensemble
          </Button>
          <Button
            variant="ghost"
            role="tab"
            aria-selected={genealogyActive}
            aria-controls="genealogy-panel"
            className={genealogyActive ? "active-tab" : ""}
            onClick={() => void navigate({ search: { vue: "genealogie" } })}
          >
            <GitBranch />
            Généalogie
          </Button>
          <Button
            variant="ghost"
            role="tab"
            aria-selected={graphActive}
            aria-controls="graph-panel"
            className={graphActive ? "active-tab" : ""}
            onClick={() => void navigate({ search: { vue: "graphe" } })}
          >
            <Network />
            Graphe
          </Button>
          <Button
            variant="ghost"
            role="tab"
            aria-selected={anomaliesActive}
            aria-controls="anomalies-panel"
            className={anomaliesActive ? "active-tab" : ""}
            onClick={() => void navigate({ search: { vue: "anomalies" } })}
          >
            <CircleAlert />
            Anomalies
          </Button>
        </div>
        {!data && <DataNotice state={result.state} />}
        {genealogyActive && data ? (
          <Genealogie
            data={data}
            selectedWork={search.oeuvre}
            selectedAnomaly={search.anomalie}
            onSelect={(id) => void navigate({ search: { vue: "genealogie", oeuvre: id } })}
            onOpenAnomaly={(id) => void navigate({ search: { vue: "anomalies", anomalie: id } })}
            onAnomaly={(id) =>
              void navigate({
                search: {
                  vue: "genealogie",
                  ...(search.oeuvre ? { oeuvre: search.oeuvre } : {}),
                  ...(id ? { anomalie: id } : {}),
                },
              })
            }
          />
        ) : graphActive && data ? (
          <Graphe
            key={`${search.type ?? "tous"}|${search.entite ?? ""}`}
            data={data}
            type={search.type}
            entite={search.entite}
          />
        ) : anomaliesActive && data ? (
          <Anomalies
            data={data}
            selected={search.anomalie}
            correction={search.correction ?? false}
            decisions={decisions}
            modifier={modifier}
            persistant={persistant}
            onSelect={(id) =>
              void navigate({ search: { vue: "anomalies", ...(id ? { anomalie: id } : {}) } })
            }
          />
        ) : overviewActive ? (
          <>
            {data && (
              <IsrcDouble
                cas={getDuplicateIsrcCases(data)}
                onCorriger={(id) =>
                  void navigate({ search: { vue: "anomalies", anomalie: id, correction: true } })
                }
              />
            )}
            <section className="reference-section">
              <div className="section-heading">
                <div>
                  <span className="section-index mono">01</span>
                  <h2>Matrice de concordance</h2>
                </div>
                <span className="section-detail">
                  {data
                    ? `${nombre(data.matrix.length)} champs · 4 sources`
                    : "4 sources de référence"}
                </span>
              </div>
              <div className="matrix-scroll">
                <table className="matrix-table">
                  <thead>
                    <tr>
                      <th>CHAMP</th>
                      {SOURCES.map((name) => (
                        <th key={name}>
                          {name}
                          {sourceInfo(data, name) && (
                            <SourceBadges
                              sources={[sourceInfo(data, name)].filter((s) => s !== undefined)}
                            />
                          )}
                        </th>
                      ))}
                      <th>CONCORDANCE</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data?.matrix.map((row) => (
                      <tr key={row.field}>
                        <th scope="row">
                          {divergents.get(row.field) ? (
                            <ChampDivergent
                              champ={divergents.get(row.field)!}
                              onOpenAnomaly={(id) =>
                                void navigate({ search: { vue: "anomalies", anomalie: id } })
                              }
                            />
                          ) : (
                            row.label
                          )}
                        </th>
                        {SOURCES.map((name) => (
                          <td key={name}>
                            <Cell cell={row.values[name]} sourceName={name} />
                          </td>
                        ))}
                        <td>
                          <span className={`matrix-status status-${row.status}`}>
                            {row.status === "concordant" ? (
                              <CircleCheck size={13} />
                            ) : row.status === "divergent" ? (
                              <CircleAlert size={13} />
                            ) : (
                              <CircleMinus size={13} />
                            )}{" "}
                            {statuts[row.status]}
                          </span>
                        </td>
                      </tr>
                    ))}
                    {!data?.matrix.length && (
                      <tr>
                        <td colSpan={6}>
                          <div className="table-empty">
                            <Layers3 size={23} strokeWidth={1.3} />
                            <span>
                              {data
                                ? "Aucun champ de concordance renseigné"
                                : "La matrice sera disponible avec les données de Senbeï."}
                            </span>
                          </div>
                        </td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
              <div className="matrix-legend">
                {["concordant", "divergent", "source_unique", "absent"].map((status) => (
                  <span key={status} className={`legend-item status-${status}`}>
                    <span className="legend-dot" />
                    {statuts[status]}
                  </span>
                ))}
              </div>
            </section>
            <section className="reference-section">
              <div className="section-heading">
                <div>
                  <span className="section-index mono">02</span>
                  <h2>Présence numérique</h2>
                </div>
                <span className="section-detail">Liens rattachés à l’artiste</span>
              </div>
              {platforms.length ? (
                <div className="platform-groups">
                  {groups.map((group) => (
                    <div className="platform-group" key={group}>
                      <h3>{group}</h3>
                      {platforms
                        .filter((p) => (categories[p.category] ?? "Référentiel") === group)
                        .map(({ node, edge, url }) => (
                          <div className="platform-item" key={node.id}>
                            {url && /^https?:\/\//.test(url) ? (
                              <Button asChild variant="outline">
                                <a href={url} target="_blank" rel="noreferrer">
                                  {node.label}
                                  <ArrowUpRight />
                                </a>
                              </Button>
                            ) : (
                              <span>{node.label}</span>
                            )}
                            <span>{edge.label}</span>
                            {edge.basis === "inferred" && (
                              <Tooltip>
                                <TooltipTrigger asChild>
                                  <span className="inferred" tabIndex={0}>
                                    inférée
                                  </span>
                                </TooltipTrigger>
                                <TooltipContent>
                                  {edge.rule ?? "Règle d’inférence non renseignée"}
                                </TooltipContent>
                              </Tooltip>
                            )}
                            <SourceBadges sources={edge.sources ?? []} />
                          </div>
                        ))}
                    </div>
                  ))}
                </div>
              ) : (
                <div className="section-empty">
                  <Network size={22} strokeWidth={1.3} />
                  <span>
                    {data
                      ? "Aucune plateforme rattachée à cet artiste"
                      : "Aucun lien de plateforme vérifié pour le moment."}
                  </span>
                </div>
              )}
            </section>
            <section className="reference-section">
              <div className="section-heading">
                <div>
                  <span className="section-index mono">03</span>
                  <h2>Chiffres clés</h2>
                </div>
                <span className="section-detail">Catalogue et identifiants</span>
              </div>
              <div className="stats-grid">
                {[
                  {
                    label: "Œuvres",
                    value: data?.stats.works,
                    Icon: FileMusic,
                    code: "ISWC",
                    rate: couverture(data?.stats.works_with_iswc, data?.stats.works),
                    covered: data?.stats.works_with_iswc,
                  },
                  {
                    label: "Enregistrements",
                    value: data?.stats.recordings,
                    Icon: AudioLines,
                    code: "ISRC",
                    rate: couverture(data?.stats.recordings_with_isrc, data?.stats.recordings),
                    covered: data?.stats.recordings_with_isrc,
                  },
                  { label: "Sorties", value: data?.stats.releases, Icon: Disc3, code: "UPC" },
                ].map(({ label, value, Icon, code, rate, covered }) => (
                  <div
                    className={`stat-item ${code === "ISWC" ? "work" : code === "ISRC" ? "recording" : "release"}`}
                    key={code}
                  >
                    <div className="stat-label">
                      <Icon size={19} />
                      <h3>{label}</h3>
                      <span className="mono">{code}</span>
                    </div>
                    <strong className="stat-number">{nombre(value)}</strong>
                    {rate && (
                      <div className="coverage">
                        <Fingerprint size={14} />
                        <span>
                          {rate} avec {code}
                        </span>
                        <span>
                          {nombre(covered)} / {nombre(value)}
                        </span>
                      </div>
                    )}
                    <SourceBadges
                      sources={sourcesCatalogue(
                        data,
                        code === "ISWC" ? "work" : code === "ISRC" ? "recording" : "release",
                      )}
                    />
                  </div>
                ))}
              </div>
            </section>
            {data && (
              <section className="reference-section">
                <div className="section-heading">
                  <div>
                    <span className="section-index mono">04</span>
                    <h2>L’iceberg du catalogue</h2>
                  </div>
                  <span className="section-detail">Œuvre, enregistrement, sortie</span>
                </div>
                <Iceberg
                  couches={getIcebergCounts(data)}
                  onOuvrir={(type) =>
                    void navigate({
                      search: type === "work" ? { vue: "genealogie" } : { vue: "graphe", type },
                    })
                  }
                />
              </section>
            )}
          </>
        ) : null}
      </main>
    </Shell>
  );
}
