import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useState } from "react";
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
import { correspondSenbei } from "@/lib/libelles";

export const Route = createFileRoute("/")({
  head: () =>
    metadata(
      "Recherche d’artiste",
      "Recherchez un artiste dans Zikindé, le référentiel vérifiable de catalogue pour les labels indépendants.",
    ),
  component: Index,
});
function Index() {
  const [query, setQuery] = useState("");
  const navigate = useNavigate();
  const found = correspondSenbei(query);
  const hasQuery = query.trim().length > 0;
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
              if (found) void navigate({ to: "/collecte/senbei" });
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
                onChange={(event) => setQuery(event.target.value)}
                autoComplete="off"
                spellCheck={false}
              />
              {hasQuery ? (
                <Button
                  type="button"
                  size="icon"
                  variant="ghost"
                  aria-label="Effacer la recherche"
                  onClick={() => setQuery("")}
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
                {found ? (
                  <Button asChild variant="ghost" className="artist-result">
                    <Link to="/collecte/senbei">
                      <span className="artist-avatar">
                        <AudioLines size={23} />
                      </span>
                      <span className="artist-result-name">
                        <strong>Senbeï</strong>
                        <span>Artiste · Référentiel disponible</span>
                      </span>
                      <ArrowRight className="result-arrow" />
                    </Link>
                  </Button>
                ) : (
                  <div className="empty-result">
                    <span>Artiste pas encore dans le référentiel</span>
                    <Button disabled size="sm">
                      Lancer la collecte <ArrowRight />
                    </Button>
                  </div>
                )}
              </div>
            )}
          </form>
          <div className="search-under">
            <span>
              <Database size={13} /> Catalogue indépendant
            </span>
            <span className="mono">WIKIDATA · MUSICBRAINZ · DEEZER · DISCOGS</span>
          </div>
          <div className="featured-artist">
            <span className="featured-label">À EXPLORER</span>
            <Button variant="link" asChild>
              <Link to="/collecte/senbei">
                Senbeï <ArrowUpRight size={16} />
              </Link>
            </Button>
            <span className="featured-note">Quatre sources, une identité.</span>
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
