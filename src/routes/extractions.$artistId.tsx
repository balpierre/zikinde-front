import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import {
  AlertTriangle,
  ArrowLeft,
  ArrowUpRight,
  Check,
  CircleDashed,
  CircleSlash,
  Clock,
  KeyRound,
  Layers3,
  LoaderCircle,
  Play,
  RefreshCw,
  RotateCw,
  Upload,
  X,
} from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Shell, metadata } from "@/components/label-pulse/shared";
import { AnomalyExplanationCard } from "@/components/extractions/anomaly-explanation";
import { RequireAuth } from "@/components/extractions/require-auth";
import {
  anomalyExplanationsOptions,
  countCatalog,
  getAnomalies,
  getArtist,
  getCatalog,
  getSourceAccounts,
  refreshArtist,
  refreshSources,
  watchJob,
  type Anomaly,
  type CatalogItem,
  type CatalogType,
  type Job,
  type StepInfo,
  type StepStatus,
} from "@/lib/backend";
import {
  anomaliesTypes,
  artistesStatuts,
  connecteurs,
  dureeFr,
  etapesStatuts,
  methodeLien,
  nomSource,
  ordreSources,
  typesCatalogue,
} from "@/lib/extraction-libelles";
import { dateFr, nombre } from "@/lib/libelles";

export const Route = createFileRoute("/extractions/$artistId")({
  ssr: false,
  head: () => metadata("Extraction", "Progression et résultats de l’extraction d’un artiste."),
  component: () => (
    <Shell active="extractions">
      <main className="content-page">
        <RequireAuth>
          <Extraction />
        </RequireAuth>
      </main>
    </Shell>
  ),
});

const stepIcons: Record<StepStatus, typeof Check> = {
  running: LoaderCircle,
  done: Check,
  error: X,
  not_configured: KeyRound,
  rate_limited: Clock,
  no_connector: CircleSlash,
  skipped: CircleDashed,
  unknown_source: CircleSlash,
};

function Extraction() {
  const { artistId } = Route.useParams();
  const queryClient = useQueryClient();
  const artist = useQuery({ queryKey: ["artiste", artistId], queryFn: () => getArtist(artistId) });
  const [job, setJob] = useState<Job | null>(null);
  const [relaunching, setRelaunching] = useState(false);

  const jobId = artist.data?.last_job_id ?? null;
  const active = job
    ? job.status === "queued" || job.status === "running"
    : artist.data?.status === "collecting";

  // Suivi en direct du dernier job ; à la fin, on relit tout.
  useEffect(() => {
    if (!jobId) return;
    let finished = false;
    const stop = watchJob(jobId, (next) => {
      setJob(next);
      if (!finished && (next.status === "done" || next.status === "error")) {
        finished = true;
        void queryClient.invalidateQueries({ queryKey: ["artiste", artistId] });
        void queryClient.invalidateQueries({ queryKey: ["resultats", artistId] });
      }
    });
    return stop;
  }, [jobId, artistId, queryClient]);

  const [relaunchError, setRelaunchError] = useState<string | null>(null);

  async function relaunch(sources?: string[]) {
    setRelaunching(true);
    setRelaunchError(null);
    try {
      if (sources?.length) await refreshSources(artistId, sources);
      else await refreshArtist(artistId);
      setJob(null);
      await queryClient.invalidateQueries({ queryKey: ["artiste", artistId] });
    } catch (e) {
      setRelaunchError(e instanceof Error ? e.message : "Relance impossible.");
    } finally {
      setRelaunching(false);
    }
  }

  if (artist.isLoading) {
    return (
      <p className="flex items-center gap-2 text-muted-foreground">
        <LoaderCircle className="animate-spin" size={16} /> Chargement…
      </p>
    );
  }
  if (artist.error || !artist.data) {
    return (
      <>
        <h1>Artiste introuvable</h1>
        <p className="text-muted-foreground">Il n’existe pas ou n’appartient pas à votre label.</p>
        <Button asChild className="mt-4">
          <Link to="/extractions">Retour aux extractions</Link>
        </Button>
      </>
    );
  }

  const a = artist.data;
  const progress = job?.progress ?? a.last_job_progress ?? {};
  const jobError = job?.error ?? a.last_job_error;

  return (
    <>
      <Button variant="link" asChild className="back-link">
        <Link to="/extractions" search={{ label: a.org_id }}>
          <ArrowLeft /> Extractions
        </Link>
      </Button>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <div className="eyebrow">
            <span className="small-line" /> EXTRACTION
          </div>
          <h1>{a.name}</h1>
          <p className="text-sm text-muted-foreground">
            {artistesStatuts[a.status]}
            {a.last_collected_at && ` · dernière collecte ${dateFr(a.last_collected_at)}`}
            {a.mbid && (
              <>
                {" · "}
                <a
                  className="underline"
                  href={`https://musicbrainz.org/artist/${a.mbid}`}
                  target="_blank"
                  rel="noreferrer"
                >
                  compte MusicBrainz choisi
                </a>
              </>
            )}
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline">
            <Link to="/artiste/$artistId" params={{ artistId }}>
              <Layers3 /> Référentiel
            </Link>
          </Button>
          <Button asChild variant="outline">
            <Link to="/collecte/$artistId" params={{ artistId }}>
              <Upload /> Sources & imports
            </Link>
          </Button>
          <Button onClick={() => relaunch()} disabled={active || relaunching} variant="outline">
            <RefreshCw className={active || relaunching ? "animate-spin" : ""} /> Relancer
            l’extraction
          </Button>
        </div>
      </div>

      <section className="mt-8" aria-labelledby="progress-title">
        <h2 id="progress-title" className="mb-3 text-lg font-semibold">
          Sources{" "}
          {active && (
            <span className="text-sm font-normal text-muted-foreground">— collecte en cours</span>
          )}
        </h2>
        {job?.status === "queued" && (
          <p className="mb-3 text-sm text-muted-foreground">En attente du moteur de collecte…</p>
        )}
        <Steps
          progress={progress}
          onRelaunch={
            a.status === "collecting" || !a.mbid ? undefined : (source) => relaunch([source])
          }
          disabled={active || relaunching}
        />
        {relaunchError && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {relaunchError}
          </p>
        )}
        {jobError && (
          <p className="mt-3 text-sm text-destructive" role="alert">
            {jobError.split("\n")[0]}
          </p>
        )}
      </section>

      {!active && a.status === "ready" && <Results artistId={artistId} knownIds={a.known_ids} />}
    </>
  );
}

function Steps({
  progress,
  onRelaunch,
  disabled,
}: {
  progress: Record<string, StepInfo>;
  onRelaunch?: ((source: string) => void) | undefined;
  disabled?: boolean;
}) {
  const keys = Object.keys(progress).sort(
    (x, y) => ((ordreSources.indexOf(x) + 99) % 99) - ((ordreSources.indexOf(y) + 99) % 99),
  );
  // Connecteurs absents de la dernière collecte (ajoutés depuis) : on peut les lancer seuls
  const missing = connecteurs.filter((c) => !(c in progress));
  if (!keys.length) {
    return (
      <p className="flex items-center gap-2 text-sm text-muted-foreground">
        <CircleDashed size={16} /> La collecte n’a pas encore commencé.
      </p>
    );
  }
  return (
    <ul className="grid gap-2 sm:grid-cols-2">
      {keys.map((key) => {
        const step = progress[key] as StepInfo;
        const Icon = stepIcons[step.status] ?? CircleDashed;
        return (
          <li key={key} className="flex items-start gap-3 rounded-lg border p-3">
            <Icon
              size={18}
              className={`mt-0.5 shrink-0 ${step.status === "running" ? "animate-spin" : ""} ${
                step.status === "done"
                  ? "text-green-600"
                  : step.status === "error"
                    ? "text-destructive"
                    : "text-muted-foreground"
              }`}
            />
            <div className="min-w-0 flex-1">
              <strong>{nomSource(key)}</strong>{" "}
              <span className="text-sm text-muted-foreground">
                {etapesStatuts[step.status] ?? step.status}
              </span>
              <div className="text-xs text-muted-foreground">{stepDetail(step)}</div>
            </div>
            {onRelaunch && connecteurs.includes(key) && step.status !== "running" && (
              <Button
                size="sm"
                variant="ghost"
                className="shrink-0"
                disabled={disabled}
                onClick={() => onRelaunch(key)}
                title={`Recollecter ${nomSource(key)} seulement`}
                aria-label={`Relancer ${nomSource(key)}`}
              >
                <RotateCw /> Relancer
              </Button>
            )}
          </li>
        );
      })}
      {onRelaunch &&
        missing.map((key) => (
          <li key={key} className="flex items-start gap-3 rounded-lg border border-dashed p-3">
            <CircleDashed size={18} className="mt-0.5 shrink-0 text-muted-foreground" />
            <div className="min-w-0 flex-1">
              <strong>{nomSource(key)}</strong>{" "}
              <span className="text-sm text-muted-foreground">Pas encore lancé</span>
              <div className="text-xs text-muted-foreground">
                Nouvelle source, absente de la dernière collecte.
              </div>
            </div>
            <Button
              size="sm"
              variant="outline"
              className="shrink-0"
              disabled={disabled}
              onClick={() => onRelaunch(key)}
              aria-label={`Lancer ${nomSource(key)}`}
            >
              <Play /> Lancer
            </Button>
          </li>
        ))}
    </ul>
  );
}

function stepDetail(step: StepInfo): string {
  if (step.status === "done") {
    const s = step.stats ?? {};
    if (s["reused"] === true) return "Repris de la collecte précédente (non relancé).";
    if (step.stored === false)
      return `${nombre(Number(s["records"] ?? 0))} éléments consultés (non stockés)`;
    if (typeof s["asked"] === "number")
      return `${nombre(Number(s["found"] ?? 0))} retrouvés sur ${nombre(s["asked"])} identifiants demandés`;
    const total = Object.entries(s)
      .filter(([k]) => k.startsWith("entity:"))
      .reduce((n, [, v]) => n + Number(v), 0);
    return total ? `${nombre(total)} éléments normalisés` : "";
  }
  if (step.status === "skipped") return "Pas demandé dans cette relance, rien à reprendre.";
  if (step.status === "unknown_source") return "Le moteur ne connaît pas cette source.";
  if (step.status === "rate_limited" && step.retry_after_s) {
    return `Quota de la source atteint, réessayer dans ${Math.ceil(step.retry_after_s / 3600)} h environ.`;
  }
  if (step.status === "not_configured") return "Clé d’accès à la source absente côté moteur.";
  if (step.status === "no_connector") return "Compte identifié ; connecteur à venir.";
  return step.error?.split("\n")[0] ?? "";
}

function Results({ artistId, knownIds }: { artistId: string; knownIds: Record<string, string[]> }) {
  const accounts = useQuery({
    queryKey: ["resultats", artistId, "comptes"],
    queryFn: () => getSourceAccounts(artistId),
  });
  const counts = useQuery({
    queryKey: ["resultats", artistId, "compteurs"],
    queryFn: () => countCatalog(artistId),
  });
  const anomalies = useQuery({
    queryKey: ["resultats", artistId, "anomalies"],
    queryFn: () => getAnomalies(artistId),
  });
  const explanations = useQuery({
    ...anomalyExplanationsOptions(artistId),
    enabled: anomalies.data?.some(canExplain) ?? false,
  });
  const explanationsById = new Map(explanations.data?.map((report) => [report.anomaly_id, report]));
  const ids = Object.entries(knownIds).sort(([x], [y]) => x.localeCompare(y));

  return (
    <>
      <section className="mt-10" aria-labelledby="ids-title">
        <h2 id="ids-title" className="mb-3 text-lg font-semibold">
          Identité
        </h2>
        <div className="flex flex-wrap gap-2">
          {ids.map(([scheme, values]) =>
            values.map((value) => (
              <Badge
                key={`${scheme}-${value}`}
                variant={values.length > 1 ? "destructive" : "outline"}
                className="mono"
              >
                {nomSource(scheme)} · {value}
              </Badge>
            )),
          )}
        </div>
        {accounts.data && accounts.data.length > 0 && (
          <ul className="mt-4 grid gap-2 sm:grid-cols-2">
            {accounts.data.map((acc) => (
              <li key={`${acc.source}-${acc.source_id}`} className="rounded-lg border p-3 text-sm">
                <strong>{nomSource(acc.source)}</strong> — {acc.name}{" "}
                {acc.url && (
                  <a
                    href={acc.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center underline"
                  >
                    voir <ArrowUpRight size={12} />
                  </a>
                )}
                <div className="text-xs text-muted-foreground">
                  Compte {methodeLien(acc.method)}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="anomalies-title">
        <h2 id="anomalies-title" className="mb-3 text-lg font-semibold">
          Anomalies{" "}
          {anomalies.data && (
            <span className="text-muted-foreground">({anomalies.data.length})</span>
          )}
        </h2>
        {anomalies.data?.length === 0 && (
          <p className="text-sm text-muted-foreground">
            Aucune anomalie détectée par les règles actuelles.
          </p>
        )}
        {explanations.isError && !explanations.data && (
          <p className="mb-3 text-sm text-muted-foreground" role="alert" lang="en">
            Could not load explanations.{" "}
            <Button
              variant="link"
              className="h-auto p-0"
              onClick={() => void explanations.refetch()}
            >
              Retry
            </Button>
          </p>
        )}
        <ul className="grid gap-2">
          {anomalies.data?.map((an) => (
            <li key={an.id} className="flex gap-3 rounded-lg border p-3 text-sm">
              <AlertTriangle size={18} className="shrink-0 text-amber-600" />
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>
                    {typeof an.details["title"] === "string"
                      ? an.details["title"]
                      : (anomaliesTypes[an.kind] ?? an.kind)}
                  </strong>
                  <span className="rounded border px-1.5 text-xs text-muted-foreground">
                    {graviteFr[an.severity] ?? an.severity}
                  </span>
                </div>
                <AnomalyDetails details={an.details} />
                {explanations.data && canExplain(an) && (
                  <AnomalyExplanationCard
                    artistId={artistId}
                    anomalyId={an.id}
                    report={explanationsById.get(an.id)}
                  />
                )}
              </div>
            </li>
          ))}
        </ul>
      </section>

      <section className="mt-10" aria-labelledby="catalog-title">
        <h2 id="catalog-title" className="mb-3 text-lg font-semibold">
          Catalogue
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Une ligne par source : un même titre vu par MusicBrainz et Deezer apparaît deux fois.
        </p>
        <Tabs defaultValue="recording">
          <TabsList className="flex-wrap">
            {(["recording", "release", "release_group", "work"] as CatalogType[]).map((t) => (
              <TabsTrigger key={t} value={t}>
                {typesCatalogue[t]}{" "}
                {counts.data && (
                  <span className="ml-1 text-muted-foreground">{nombre(counts.data[t])}</span>
                )}
              </TabsTrigger>
            ))}
          </TabsList>
          {(["recording", "release", "release_group", "work"] as CatalogType[]).map((t) => (
            <TabsContent key={t} value={t}>
              <CatalogTable artistId={artistId} type={t} />
            </TabsContent>
          ))}
        </Tabs>
      </section>
    </>
  );
}

const graviteFr: Record<string, string> = {
  error: "gravité haute",
  warning: "gravité moyenne",
  info: "information",
};

interface Observation {
  source?: string;
  value?: unknown;
  url?: string;
}

function canExplain(anomaly: Anomaly) {
  const observations = anomaly.details["observations"];
  return (
    anomaly.status === "open" &&
    ["missing_isrc", "work_without_iswc"].includes(anomaly.kind) &&
    typeof anomaly.details["key"] === "string" &&
    anomaly.details["key"] !== "" &&
    Array.isArray(observations) &&
    (observations as (Observation | null)[]).some(
      (item) =>
        (item?.source === "musicbrainz" || item?.source === "wikidata") &&
        typeof item.url === "string" &&
        typeof item.value === "string",
    )
  );
}

function texte(v: unknown): string {
  if (v == null) return "—";
  if (Array.isArray(v)) return v.map(texte).join(", ");
  if (typeof v === "object") return JSON.stringify(v);
  return String(v);
}

function AnomalyDetails({ details }: { details: Record<string, unknown> }) {
  const values = details["values"];
  if (details["scheme"] && values && typeof values === "object") {
    return (
      <div className="text-muted-foreground">
        {nomSource(String(details["scheme"]))} :{" "}
        {Object.entries(values as Record<string, string[]>)
          .map(([v, srcs]) => `${v} (selon ${srcs.map(nomSource).join(", ")})`)
          .join(" ≠ ")}
      </div>
    );
  }
  const description = details["description"];
  const action = details["suggested_action"];
  const target = details["target"];
  const observations = Array.isArray(details["observations"])
    ? (details["observations"] as Observation[])
    : [];
  const items = Array.isArray(details["items"]) ? (details["items"] as unknown[]) : [];
  return (
    <div className="mt-1 grid gap-1.5 text-muted-foreground">
      {typeof description === "string" && <p>{description}</p>}
      {observations.length > 0 && (
        <ul className="grid gap-0.5">
          {observations.map((o, i) => (
            <li key={i} className="break-words">
              <span className="font-medium text-foreground">{nomSource(o.source ?? "")}</span> :{" "}
              {o.url ? (
                <a href={o.url} target="_blank" rel="noreferrer" className="underline">
                  {texte(o.value)}
                </a>
              ) : (
                texte(o.value)
              )}
            </li>
          ))}
        </ul>
      )}
      {items.length > 0 && (
        <details>
          <summary className="cursor-pointer">{items.length} élément(s) concerné(s)</summary>
          <ul className="mt-1 grid max-h-64 gap-0.5 overflow-auto text-xs">
            {items.map((it, i) => (
              <li key={i} className="break-words">
                {it && typeof it === "object"
                  ? Object.entries(it as Record<string, unknown>)
                      .map(([k, v]) => `${k} : ${texte(v)}`)
                      .join(" · ")
                  : texte(it)}
              </li>
            ))}
          </ul>
        </details>
      )}
      {typeof action === "string" && (
        <p>
          <span className="font-medium text-foreground">À faire</span>
          {typeof target === "string" && target ? ` (${target})` : ""} : {action}
        </p>
      )}
    </div>
  );
}

function identifier(item: CatalogItem, scheme: string): string {
  return item.identifiers
    .filter((i) => i.scheme === scheme)
    .map((i) => i.value)
    .join(", ");
}

function CatalogTable({ artistId, type }: { artistId: string; type: CatalogType }) {
  const items = useQuery({
    queryKey: ["resultats", artistId, "catalogue", type],
    queryFn: () => getCatalog(artistId, type),
  });
  const [filter, setFilter] = useState("");
  const rows = useMemo(() => {
    const f = filter.trim().toLowerCase();
    return (items.data ?? []).filter(
      (i) =>
        !f ||
        i.name.toLowerCase().includes(f) ||
        i.identifiers.some((id) => id.value.toLowerCase().includes(f)),
    );
  }, [items.data, filter]);
  const code =
    type === "recording" ? "isrc" : type === "release" ? "upc" : type === "work" ? "iswc" : null;

  if (items.isLoading) return <p className="py-4 text-sm text-muted-foreground">Chargement…</p>;
  if (items.error) return <p className="py-4 text-sm text-destructive">{items.error.message}</p>;
  return (
    <>
      <Input
        className="my-3 max-w-sm"
        placeholder={`Filtrer par titre${code ? ` ou ${code.toUpperCase()}` : ""}…`}
        value={filter}
        onChange={(e) => setFilter(e.target.value)}
        aria-label="Filtrer le catalogue"
      />
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Titre</TableHead>
            <TableHead>Source</TableHead>
            {code && <TableHead>{code.toUpperCase()}</TableHead>}
            <TableHead>{type === "recording" ? "Durée" : "Date"}</TableHead>
            <TableHead />
          </TableRow>
        </TableHeader>
        <TableBody>
          {rows.map((item) => {
            const attrs = item.attributes;
            const date = (attrs["date"] ?? attrs["first_release_date"] ?? attrs["release_date"]) as
              string | undefined;
            const duration =
              typeof attrs["duration_s"] === "number"
                ? (attrs["duration_s"] as number)
                : typeof attrs["length_ms"] === "number"
                  ? (attrs["length_ms"] as number) / 1000
                  : null;
            return (
              <TableRow key={item.source_entity_id}>
                <TableCell className="font-medium">{item.name}</TableCell>
                <TableCell>{nomSource(item.source)}</TableCell>
                {code && (
                  <TableCell className="mono text-xs">
                    {identifier(item, code) || <span className="text-amber-600">manquant</span>}
                  </TableCell>
                )}
                <TableCell className="text-sm text-muted-foreground">
                  {type === "recording" ? dureeFr(duration) : (date ?? "—")}
                </TableCell>
                <TableCell>
                  {item.url && (
                    <a
                      href={item.url}
                      target="_blank"
                      rel="noreferrer"
                      aria-label={`Ouvrir ${item.name} sur ${nomSource(item.source)}`}
                    >
                      <ArrowUpRight size={14} />
                    </a>
                  )}
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
      {rows.length === 0 && <p className="py-4 text-sm text-muted-foreground">Aucun élément.</p>}
    </>
  );
}
