import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
import { LoaderCircle } from "lucide-react";
import {
  ArrowRight,
  ArrowUpRight,
  AudioLines,
  Search,
  X,
  Database,
  CornerDownLeft,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Concepts, Shell, metadata } from "@/components/label-pulse/shared";
import { useSession } from "@/hooks/use-session";
import {
  ensureOrganization,
  requestDiscover,
  trackArtist,
  waitJob,
  type Candidate,
} from "@/lib/backend";

export const Route = createFileRoute("/")({
  head: () =>
    metadata(
      "Recherche d’artiste",
      "Recherchez un artiste dans Zikindé, le référentiel vérifiable de catalogue pour les labels indépendants.",
    ),
  component: Index,
});
type Phase = "idle" | "searching" | "candidates" | "starting" | "error";

function Index() {
  const [query, setQuery] = useState("");
  const [phase, setPhase] = useState<Phase>("idle");
  const [candidates, setCandidates] = useState<Candidate[]>([]);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const { session } = useSession();
  const hasQuery = query.trim().length > 0;

  async function search() {
    const name = query.trim();
    if (!name) return;
    if (!session) {
      void navigate({ to: "/connexion", search: { redirect: "/" } });
      return;
    }
    setPhase("searching");
    setError(null);
    try {
      const org = await ensureOrganization();
      const job = await waitJob(await requestDiscover(org.id, name));
      if (job.status === "error") throw new Error(job.error ?? "La recherche a échoué.");
      setCandidates(((job.result?.["candidates"] as Candidate[] | undefined) ?? []).slice(0, 8));
      setPhase("candidates");
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }

  async function choose(candidate: Candidate) {
    setPhase("starting");
    try {
      const org = await ensureOrganization();
      const artistId = await trackArtist(org.id, candidate.name, candidate.source_id);
      void navigate({ to: "/extractions/$artistId", params: { artistId } });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
      setPhase("error");
    }
  }

  return (
    <Shell>
      <main className="search-page">
        <div className="search-intro">
          <div className="eyebrow">
            <span className="small-line" /> RÉFÉRENTIEL DE CATALOGUE
          </div>
          <h1>
            Rechercher
            <br />
            un <span className="serif-word">artiste.</span>
          </h1>
          <div className="search-meta">
            <span>Remonter aux sources.</span>
            <span>Retrouver les liens.</span>
          </div>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              void search();
            }}
            className={`search-box ${hasQuery ? "search-box-open" : ""}`}
          >
            <div className="search-input-row">
              <Search size={23} aria-hidden="true" />
              <input
                aria-label="Rechercher un artiste"
                aria-autocomplete="list"
                aria-controls="artist-results"
                placeholder="Un nom d’artiste…"
                value={query}
                onChange={(event) => {
                  setQuery(event.target.value);
                  setPhase("idle");
                }}
                autoComplete="off"
                spellCheck={false}
              />
              {hasQuery ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Effacer la recherche"
                  onClick={() => {
                    setQuery("");
                    setPhase("idle");
                  }}
                >
                  <X />
                </Button>
              ) : (
                <span className="search-enter" aria-hidden="true">
                  <CornerDownLeft size={16} />
                </span>
              )}
            </div>
            {hasQuery && (
              <div id="artist-results" className="search-results" aria-live="polite">
                {phase === "idle" && (
                  <div className="empty-result">
                    <span>
                      {session
                        ? "Chercher cet artiste dans les sources"
                        : "Connectez-vous pour lancer une extraction"}
                    </span>
                    <Button type="submit" size="sm">
                      {session ? "Rechercher" : "Se connecter"} <ArrowRight />
                    </Button>
                  </div>
                )}
                {(phase === "searching" || phase === "starting") && (
                  <div className="empty-result">
                    <span className="flex items-center gap-2">
                      <LoaderCircle className="animate-spin" size={16} />
                      {phase === "searching"
                        ? "Recherche des comptes possibles…"
                        : "Lancement de l’extraction…"}
                    </span>
                  </div>
                )}
                {phase === "error" && (
                  <div className="empty-result">
                    <span className="text-destructive">{error}</span>
                    <Button type="submit" size="sm" variant="outline">
                      Réessayer
                    </Button>
                  </div>
                )}
                {phase === "candidates" && candidates.length === 0 && (
                  <div className="empty-result">
                    <span>Aucun compte trouvé pour ce nom.</span>
                  </div>
                )}
                {phase === "candidates" && candidates.length > 0 && (
                  <>
                    <div className="px-4 pt-3 text-xs text-muted-foreground">
                      Choisissez le bon artiste : une ressemblance de nom n’est pas une preuve.
                    </div>
                    {candidates.map((c) => (
                      <Button
                        key={c.source_id}
                        type="button"
                        variant="ghost"
                        className="artist-result"
                        onClick={() => void choose(c)}
                      >
                        <span className="artist-avatar">
                          <AudioLines size={23} />
                        </span>
                        <span className="artist-result-name">
                          <strong>{c.name}</strong>
                          <span>
                            {[
                              c.evidence.type,
                              c.evidence.area,
                              c.evidence.disambiguation,
                              c.evidence.aliases?.length
                                ? `alias ${c.evidence.aliases.join(", ")}`
                                : null,
                              c.evidence.isnis?.length ? `ISNI ${c.evidence.isnis[0]}` : null,
                            ]
                              .filter(Boolean)
                              .join(" · ") || "Aucun indice complémentaire"}
                          </span>
                        </span>
                        <ArrowRight className="result-arrow" />
                      </Button>
                    ))}
                  </>
                )}
              </div>
            )}
          </form>
          <div className="search-under">
            <span>
              <Database size={13} /> Catalogue indépendant
            </span>
            <span className="mono">MUSICBRAINZ · DEEZER · SPOTIFY · YOUTUBE</span>
          </div>
        </div>
        <div className="catalogue-mark" aria-hidden="true">
          <div className="mark-top mono">
            <span>ZK—001</span>
            <span>RÉFÉRENTIEL</span>
          </div>
          <svg
            viewBox="0 0 280 280"
            className="record-visual"
            role="img"
            aria-label="Disque et signal audio"
          >
            <g className="record-grooves">
              {[124, 115, 106, 97, 88, 79, 70, 61].map((r) => (
                <circle key={r} cx="140" cy="140" r={r} />
              ))}
            </g>
            <circle className="record-label" cx="140" cy="140" r="43" />
            <path
              className="record-signal"
              d="M108 140h9v-12h5v24h5v-39h5v54h5v-67h5v80h5v-54h5v33h5v-19h15"
            />
            <circle className="record-center" cx="140" cy="140" r="4" />
          </svg>
          <div className="mark-bottom">
            <span className="mono">
              LA TRACE
              <br />
              DE CHAQUE TITRE.
            </span>
            <ArrowUpRight size={28} strokeWidth={1} />
          </div>
        </div>
      </main>
      <div className="search-bottom">
        <Concepts />
      </div>
    </Shell>
  );
}
