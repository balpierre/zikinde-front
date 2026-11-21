import { Link } from "@tanstack/react-router";
import {
  ArrowUpRight,
  AudioLines,
  ListChecks,
  LogIn,
  LogOut,
  Disc3,
  FileMusic,
  Search,
  ShieldCheck,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { dateFr, mentionLectureSeule } from "@/lib/libelles";
import type { Source } from "@/lib/referentiel";
import { useSession } from "@/hooks/use-session";
import { signOut } from "@/lib/backend";

export function PulseLogo() {
  return (
    <Link to="/" className="brand" aria-label="Zikindé — accueil">
      <AudioLines aria-hidden="true" />
      <span>
        zik<span className="brand-accent">indé</span>
        <span className="brand-dot">.</span>
      </span>
    </Link>
  );
}
export function Shell({
  children,
  active = "search",
}: {
  children: React.ReactNode;
  active?: "search" | "reference" | "extractions";
}) {
  const { session } = useSession();
  return (
    <TooltipProvider delayDuration={180}>
      <div className="app-shell">
        <header className="site-header">
          <PulseLogo />
          <nav aria-label="Navigation principale">
            <Button variant="ghost" asChild className={active === "search" ? "nav-active" : ""}>
              <Link to="/">
                <Search />
                Recherche
              </Link>
            </Button>
            <Button
              variant="ghost"
              asChild
              className={active === "extractions" ? "nav-active" : ""}
            >
              <Link to="/extractions">
                <ListChecks />
                Extractions
              </Link>
            </Button>
            {session ? (
              <Button
                variant="ghost"
                title={session.user.email ?? undefined}
                onClick={() => void signOut().then(() => window.location.assign("/"))}
              >
                <LogOut />
                Déconnexion
              </Button>
            ) : (
              <Button variant="ghost" asChild>
                <Link to="/connexion" search={{ redirect: "/extractions" }}>
                  <LogIn />
                  Connexion
                </Link>
              </Button>
            )}
          </nav>
          <span className="header-caption">LA MUSIQUE, À LA SOURCE</span>
        </header>
        {children}
        <footer className="site-footer">
          <span>
            Zikindé <span className="footer-separator">/</span> Référentiel musical indépendant
          </span>
          <span>
            <ShieldCheck size={14} /> Des données, pas des suppositions.
          </span>
        </footer>
      </div>
    </TooltipProvider>
  );
}
export const concepts = [
  {
    name: "Œuvre",
    code: "ISWC",
    Icon: FileMusic,
    subtitle: "La composition originale",
    number: "01",
    className: "work",
  },
  {
    name: "Enregistrement",
    code: "ISRC",
    Icon: AudioLines,
    subtitle: "Une interprétation fixée",
    number: "02",
    className: "recording",
  },
  {
    name: "Sortie",
    code: "UPC",
    Icon: Disc3,
    subtitle: "Une édition distribuée",
    number: "03",
    className: "release",
  },
];
export function Concepts({ compact = false }: { compact?: boolean }) {
  if (compact)
    return (
      <div
        className="concept-compact"
        aria-label="Œuvre ISWC, distincte de l’enregistrement ISRC, distinct de la sortie UPC"
      >
        {concepts.map(({ name, code, Icon, className }, i) => (
          <span key={code} className={`concept-mini ${className}`}>
            {i > 0 && <span className="not-equal">≠</span>}
            <Icon size={15} />
            {name}
            <span className="mono">{code}</span>
          </span>
        ))}
      </div>
    );
  return (
    <section className="concept-band" aria-label="Les trois niveaux du catalogue">
      <div className="section-overline">
        <span>UN CATALOGUE. TROIS RÉALITÉS.</span>
        <span className="mono">ŒUVRE ≠ ENREGISTREMENT ≠ SORTIE</span>
      </div>
      <div className="concept-grid">
        {concepts.map(({ name, code, Icon, subtitle, number, className }) => (
          <div className={`concept-item ${className}`} key={code}>
            <div className="concept-top">
              <Icon size={25} strokeWidth={1.4} />
              <span className="concept-number mono">{number}</span>
            </div>
            <h2>
              {name}
              <span className="code-tag mono">{code}</span>
            </h2>
            <p>{subtitle}</p>
          </div>
        ))}
      </div>
    </section>
  );
}
export function SourceBadge({ source }: { source: Source }) {
  const valid = /^https?:\/\//.test(source.source_url);
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        {valid ? (
          <a className="source-badge" href={source.source_url} target="_blank" rel="noreferrer">
            {source.name}
            <ArrowUpRight size={10} />
          </a>
        ) : (
          <span className="source-badge">{source.name}</span>
        )}
      </TooltipTrigger>
      <TooltipContent>Collectée le {dateFr(source.collected_at)}</TooltipContent>
    </Tooltip>
  );
}
export function SourceBadges({ sources }: { sources?: Source[] }) {
  return sources?.length ? (
    <span className="source-badges">
      {sources.map((source, i) => (
        <SourceBadge key={`${source.name}-${i}`} source={source} />
      ))}
    </span>
  ) : null;
}
export function LectureSeule({ compact = false }: { compact?: boolean }) {
  return (
    <p className={`read-only-notice ${compact ? "compact" : ""}`} role="note">
      <ShieldCheck size={compact ? 13 : 15} aria-hidden="true" />
      <span>{mentionLectureSeule}</span>
    </p>
  );
}
export function DataNotice({ state, artistId }: { state: string; artistId?: string }) {
  return (
    <div className="data-notice" role="status">
      <span className="status-dot" />
      <div>
        <strong>
          {state === "invalid"
            ? "Le référentiel ne peut pas être lu"
            : state === "unavailable"
              ? "Le référentiel est momentanément indisponible"
              : "Référentiel en cours de calcul"}
        </strong>
        <p>
          {state === "invalid" ? (
            "Le format des données ne correspond pas au référentiel attendu."
          ) : state === "missing" && artistId ? (
            <>
              Il sera disponible à la fin de la collecte.{" "}
              <Link className="underline" to="/extractions/$artistId" params={{ artistId }}>
                Lancer une collecte
              </Link>
            </>
          ) : (
            "Aucun chiffre ni aucune source ne sont présentés comme vérifiés sans référentiel calculé."
          )}
        </p>
      </div>
    </div>
  );
}
export function PageError() {
  return (
    <Shell>
      <main className="content-page">
        <h1>Le référentiel n’a pas pu être chargé</h1>
        <Button asChild>
          <Link to="/">Revenir à la recherche</Link>
        </Button>
      </main>
    </Shell>
  );
}
export function PageNotFound() {
  return (
    <Shell>
      <main className="content-page">
        <h1>Artiste introuvable</h1>
        <Button asChild>
          <Link to="/">Revenir à la recherche</Link>
        </Button>
      </main>
    </Shell>
  );
}
export function metadata(title: string, description: string) {
  return {
    meta: [
      { title: `${title} — Zikindé` },
      { name: "description", content: description },
      { property: "og:title", content: `${title} — Zikindé` },
      { property: "og:description", content: description },
      { property: "og:type", content: "website" },
      { name: "twitter:card", content: "summary_large_image" },
    ],
  };
}
