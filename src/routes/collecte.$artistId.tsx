import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useEffect, useState, type FormEvent } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  Database,
  FileSpreadsheet,
  Globe2,
  AudioLines,
  Disc3,
  LoaderCircle,
  Trash2,
  Upload,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Shell,
  Concepts,
  DataNotice,
  SourceBadges,
  metadata,
} from "@/components/label-pulse/shared";
import { RequireAuth } from "@/components/extractions/require-auth";
import {
  MAX_LIGNES_IMPORT,
  createManualImport,
  deleteManualImport,
  getArtist,
  listManualImports,
  watchJob,
  type Job,
  type ManualImport,
} from "@/lib/backend";
import { parseCsv } from "@/lib/csv";
import { referentielQuery } from "@/lib/referentiel";
import { dateFr, nombre } from "@/lib/libelles";

export const Route = createFileRoute("/collecte/$artistId")({
  ssr: false,
  head: () =>
    metadata(
      "Sources & imports",
      "Les sources croisées dans le référentiel d’un artiste et ses imports manuels de catalogue.",
    ),
  component: () => (
    <Shell active="extractions">
      <main className="content-page collection-page">
        <RequireAuth>
          <Collecte />
        </RequireAuth>
      </main>
    </Shell>
  ),
});

const icons: Record<string, typeof Database> = {
  Wikidata: Globe2,
  MusicBrainz: Database,
  Deezer: AudioLines,
  Discogs: Disc3,
};

function Collecte() {
  const { artistId } = Route.useParams();
  const queryClient = useQueryClient();
  const artist = useQuery({ queryKey: ["artiste", artistId], queryFn: () => getArtist(artistId) });
  const referentiel = useQuery(referentielQuery(artistId));
  const imports = useQuery({
    queryKey: ["imports", artistId],
    queryFn: () => listManualImports(artistId),
  });
  const [job, setJob] = useState<Job | null>(null);

  // Suivi du dernier job de l'artiste (le `reconcile` mis en file par un import) ;
  // à la fin, le référentiel est relu.
  const jobId = artist.data?.last_job_id ?? null;
  useEffect(() => {
    if (!jobId) return;
    let finished = false;
    const stop = watchJob(jobId, (next) => {
      setJob(next);
      if (!finished && (next.status === "done" || next.status === "error")) {
        finished = true;
        void queryClient.invalidateQueries({ queryKey: referentielQuery(artistId).queryKey });
        void queryClient.invalidateQueries({ queryKey: ["imports", artistId] });
      }
    });
    return stop;
  }, [jobId, artistId, queryClient]);
  const active = job ? job.status === "queued" || job.status === "running" : false;

  // Un import ou une suppression met un job en file : on relit l'artiste pour récupérer son id.
  async function apresModification() {
    setJob(null);
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["artiste", artistId] }),
      queryClient.invalidateQueries({ queryKey: ["imports", artistId] }),
    ]);
  }

  const result = referentiel.data ?? {
    data: null,
    state: referentiel.isError ? "unavailable" : "loading",
  };
  const { data } = result;
  const sources = data?.meta.sources ?? [];

  return (
    <>
      <Button variant="link" asChild className="back-link">
        <Link to="/extractions/$artistId" params={{ artistId }}>
          <ArrowLeft />
          Extraction
        </Link>
      </Button>
      <div className="page-heading">
        <div>
          <div className="eyebrow">CROISEMENT DES SOURCES</div>
          <h1>
            {data?.meta.artist_name ?? artist.data?.name ?? "Artiste"}
            <span className="heading-dot">.</span>
          </h1>
          <p>Les sources publiques et les imports du label, croisés en un référentiel.</p>
        </div>
        <span className="stage-label mono">
          {active
            ? "CALCUL EN COURS"
            : `${nombre(sources.length)} SOURCE${sources.length > 1 ? "S" : ""}`}
        </span>
      </div>
      <Concepts compact />
      {result.state === "loading" ? (
        <p className="flex items-center gap-2 text-muted-foreground" role="status">
          <LoaderCircle className="animate-spin" size={16} /> Chargement du référentiel…
        </p>
      ) : (
        !data && <DataNotice state={result.state} artistId={artistId} />
      )}
      {sources.length > 0 && (
        <div className="collection-list">
          {sources.map((source, index) => {
            const Icon = icons[source.name] ?? FileSpreadsheet;
            return (
              <div key={source.name} className="collection-source source-revealed">
                <span className="mono source-number">{String(index + 1).padStart(2, "0")}</span>
                <span className="source-icon">
                  <Icon size={23} strokeWidth={1.5} />
                </span>
                <div className="collection-source-body">
                  <h2>
                    {source.name}
                    {source.contribution?.includes("Identité pivot") && (
                      <span className="code-tag">PIVOT D’IDENTITÉ</span>
                    )}
                  </h2>
                  <p>{source.contribution || "Aucun élément rattaché"}</p>
                  {/^https?:\/\//.test(source.source_url) && <SourceBadges sources={[source]} />}
                </div>
                <div className="collection-source-meta">
                  <span>{source.collected_at ? dateFr(source.collected_at) : "—"}</span>
                  {source.count != null && <strong>{nombre(source.count)} éléments</strong>}
                </div>
                <span className="collection-state">
                  <Check size={19} />
                </span>
              </div>
            );
          })}
        </div>
      )}

      <section className="reference-section" aria-labelledby="imports-title">
        <div className="section-heading">
          <div>
            <span className="section-index mono">+</span>
            <h2 id="imports-title">Imports manuels</h2>
          </div>
          <span className="section-detail">
            {active ? (
              <span className="flex items-center gap-2">
                <LoaderCircle className="animate-spin" size={14} /> Recalcul du référentiel…
              </span>
            ) : job?.status === "error" ? (
              <span className="text-destructive">Le dernier calcul a échoué</span>
            ) : (
              "Fichiers CSV du label"
            )}
          </span>
        </div>
        <FormulaireImport artistId={artistId} disabled={active} onDone={apresModification} />
        <ListeImports
          imports={imports.data ?? []}
          loading={imports.isLoading}
          error={imports.error}
          disabled={active}
          onDeleted={apresModification}
        />
      </section>

      {data && (
        <section className="collection-summary">
          <div>
            <div className="eyebrow">SYNTHÈSE DU RÉFÉRENTIEL</div>
            <div className="summary-counts">
              {[
                ["Œuvres", data.stats.works],
                ["Enregistrements", data.stats.recordings],
                ["Sorties", data.stats.releases],
                ["Anomalies", data.stats.anomalies],
              ].map(([label, value]) => (
                <span key={String(label)}>
                  <strong>{nombre(typeof value === "number" ? value : undefined)}</strong>
                  {label}
                </span>
              ))}
            </div>
          </div>
          <Button asChild size="lg">
            <Link to="/artiste/$artistId" params={{ artistId }}>
              Ouvrir le référentiel
              <ArrowRight />
            </Link>
          </Button>
        </section>
      )}
    </>
  );
}

function FormulaireImport({
  artistId,
  disabled,
  onDone,
}: {
  artistId: string;
  disabled: boolean;
  onDone: () => Promise<void>;
}) {
  const [name, setName] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [inputKey, setInputKey] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  async function submit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    if (!name.trim()) return setError("Le nom de l’import est obligatoire.");
    if (!file) return setError("Choisissez un fichier CSV.");
    setSending(true);
    try {
      const { colonnes, lignes } = parseCsv(await file.text());
      if (!colonnes.length || !lignes.length)
        throw new Error("Le fichier ne contient aucune ligne de données sous l’en-tête.");
      if (lignes.length > MAX_LIGNES_IMPORT)
        throw new Error(
          `Le fichier contient ${nombre(lignes.length)} lignes : la limite est de ${nombre(MAX_LIGNES_IMPORT)}.`,
        );
      await createManualImport(artistId, name.trim(), file.name, lignes);
      setMessage(`${nombre(lignes.length)} lignes importées. Le référentiel va être recalculé.`);
      setName("");
      setFile(null);
      setInputKey((k) => k + 1);
      await onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSending(false);
    }
  }

  return (
    <form onSubmit={(e) => void submit(e)} className="mb-6 grid gap-4 sm:grid-cols-[1fr_1fr_auto]">
      <div className="grid gap-2">
        <Label htmlFor="import-name">Nom de l’import</Label>
        <Input
          id="import-name"
          required
          value={name}
          placeholder="Catalogue distributeur 2026"
          onChange={(e) => setName(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="import-file">Fichier CSV</Label>
        <Input
          key={inputKey}
          id="import-file"
          type="file"
          accept=".csv,text/csv"
          required
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
        />
      </div>
      <Button type="submit" className="self-end" disabled={disabled || sending}>
        {sending ? <LoaderCircle className="animate-spin" /> : <Upload />}
        Importer
      </Button>
      <p className="text-sm text-muted-foreground sm:col-span-3">
        Colonnes reconnues : <code>titre</code>/<code>title</code>, <code>isrc</code>,{" "}
        <code>upc</code>/<code>ean</code>/<code>barcode</code>, <code>iswc</code>, <code>type</code>{" "}
        (recording, release ou work), <code>date</code>, <code>label</code>, <code>duree</code>/
        <code>duration</code> ; les autres colonnes sont gardées comme informations. Séparateur{" "}
        <code>,</code> ou <code>;</code>, en-tête en première ligne, {nombre(MAX_LIGNES_IMPORT)}{" "}
        lignes au plus.
      </p>
      {error && (
        <p className="text-sm text-destructive sm:col-span-3" role="alert">
          {error}
        </p>
      )}
      {message && (
        <p className="text-sm sm:col-span-3" role="status">
          {message}
        </p>
      )}
    </form>
  );
}

function ListeImports({
  imports,
  loading,
  error,
  disabled,
  onDeleted,
}: {
  imports: ManualImport[];
  loading: boolean;
  error: Error | null;
  disabled: boolean;
  onDeleted: () => Promise<void>;
}) {
  const [deleting, setDeleting] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  async function remove(id: string) {
    setDeleting(id);
    setDeleteError(null);
    try {
      await deleteManualImport(id);
      await onDeleted();
    } catch (e) {
      setDeleteError(e instanceof Error ? e.message : String(e));
    } finally {
      setDeleting(null);
    }
  }

  if (loading)
    return (
      <p className="flex items-center gap-2 text-muted-foreground" role="status">
        <LoaderCircle className="animate-spin" size={16} /> Chargement des imports…
      </p>
    );
  if (error)
    return (
      <p className="text-sm text-destructive" role="alert">
        Les imports n’ont pas pu être lus : {error.message}
      </p>
    );
  if (!imports.length)
    return (
      <div className="section-empty">
        <FileSpreadsheet size={22} strokeWidth={1.3} />
        <span>Aucun import manuel pour cet artiste.</span>
      </div>
    );
  return (
    <>
      {deleteError && (
        <p className="mb-2 text-sm text-destructive" role="alert">
          {deleteError}
        </p>
      )}
      <ul className="grid gap-2">
        {imports.map((imp) => (
          <li
            key={imp.id}
            className="flex flex-wrap items-center justify-between gap-3 rounded-md border p-3"
          >
            <div>
              <strong>{imp.name}</strong>
              <p className="text-sm text-muted-foreground">
                {[
                  imp.filename,
                  `${nombre(imp.row_count)} ligne${imp.row_count > 1 ? "s" : ""}`,
                  imp.columns?.length ? `colonnes : ${imp.columns.join(", ")}` : null,
                  `importé le ${dateFr(imp.created_at)}`,
                ]
                  .filter(Boolean)
                  .join(" · ")}
              </p>
            </div>
            <AlertDialog>
              <AlertDialogTrigger asChild>
                <Button
                  variant="outline"
                  size="sm"
                  disabled={disabled || deleting === imp.id}
                  aria-label={`Supprimer l’import ${imp.name}`}
                >
                  {deleting === imp.id ? <LoaderCircle className="animate-spin" /> : <Trash2 />}
                  Supprimer
                </Button>
              </AlertDialogTrigger>
              <AlertDialogContent>
                <AlertDialogHeader>
                  <AlertDialogTitle>Supprimer l’import « {imp.name} » ?</AlertDialogTitle>
                  <AlertDialogDescription>
                    Ses {nombre(imp.row_count)} lignes ne seront plus prises en compte et le
                    référentiel sera recalculé. Cette action est définitive.
                  </AlertDialogDescription>
                </AlertDialogHeader>
                <AlertDialogFooter>
                  <AlertDialogCancel>Annuler</AlertDialogCancel>
                  <AlertDialogAction onClick={() => void remove(imp.id)}>
                    Supprimer
                  </AlertDialogAction>
                </AlertDialogFooter>
              </AlertDialogContent>
            </AlertDialog>
          </li>
        ))}
      </ul>
    </>
  );
}
