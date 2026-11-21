import { createFileRoute, Link } from "@tanstack/react-router";
import { useSuspenseQuery } from "@tanstack/react-query";
import { useEffect, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  Check,
  LoaderCircle,
  Database,
  Globe2,
  AudioLines,
  Disc3,
  CircleHelp,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Shell,
  Concepts,
  DataNotice,
  PageError,
  PageNotFound,
  SourceBadges,
  metadata,
} from "@/components/label-pulse/shared";
import { SOURCES, referentielQuery, sourceInfo } from "@/lib/referentiel";
import { dateFr, nombre } from "@/lib/libelles";

export const Route = createFileRoute("/collecte/senbei")({
  head: () =>
    metadata(
      "Collecte · Senbeï",
      "Les sources du catalogue de Senbeï : Wikidata, MusicBrainz, Deezer et Discogs.",
    ),
  loader: async ({ context }) => {
    await context.queryClient.ensureQueryData(referentielQuery);
  },
  errorComponent: PageError,
  notFoundComponent: PageNotFound,
  component: Collecte,
});
const icons = [Globe2, Database, AudioLines, Disc3];
function Collecte() {
  const { data: result } = useSuspenseQuery(referentielQuery);
  const [step, setStep] = useState(0);
  useEffect(() => {
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) {
      setStep(4);
      return;
    }
    const timer = window.setInterval(() => setStep((previous) => Math.min(previous + 1, 4)), 600);
    return () => window.clearInterval(timer);
  }, []);
  const { data } = result;
  return (
    <Shell active="reference">
      <main className="content-page collection-page">
        <Button variant="link" asChild className="back-link">
          <Link to="/">
            <ArrowLeft />
            Recherche
          </Link>
        </Button>
        <div className="page-heading">
          <div>
            <div className="eyebrow">CROISEMENT DES SOURCES</div>
            <h1>
              Senbeï<span className="heading-dot">.</span>
            </h1>
            <p>Quatre regards sur un même catalogue.</p>
          </div>
          <span className="stage-label mono">
            {step < 4 ? `${step} / 4 SOURCES` : "LECTURE TERMINÉE"}
          </span>
        </div>
        <Concepts compact />
        {!data && <DataNotice state={result.state} />}
        <div className="collection-list" aria-live="polite">
          {SOURCES.map((name, index) => {
            const source = sourceInfo(data, name);
            const Icon = icons[index] ?? Database;
            const appeared = step > index;
            return (
              <div key={name} className={`collection-source ${appeared ? "source-revealed" : ""}`}>
                <span className="mono source-number">0{index + 1}</span>
                <span className="source-icon">
                  <Icon size={23} strokeWidth={1.5} />
                </span>
                <div className="collection-source-body">
                  <h2>
                    {name}
                    {index === 0 && <span className="code-tag">PIVOT D’IDENTITÉ</span>}
                  </h2>
                  <p>
                    {appeared
                      ? (source?.contribution ?? "Données de cette source en attente")
                      : "En attente de lecture"}
                  </p>
                  {appeared && <SourceBadges sources={source ? [source] : []} />}
                </div>
                <div className="collection-source-meta">
                  <span>{appeared ? dateFr(source?.collected_at) : "—"}</span>
                  {appeared && source?.count != null && (
                    <strong>{nombre(source.count)} éléments</strong>
                  )}
                </div>
                <span className="collection-state">
                  {!appeared ? (
                    step === index ? (
                      <LoaderCircle className="spin" size={18} />
                    ) : (
                      <span className="pending-circle" />
                    )
                  ) : source ? (
                    <Check size={19} />
                  ) : (
                    <CircleHelp size={19} />
                  )}
                </span>
              </div>
            );
          })}
        </div>
        {step === 4 && (
          <section className="collection-summary">
            <div>
              <div className="eyebrow">SYNTHÈSE DU RÉFÉRENTIEL</div>
              <h2>
                {sourceInfo(data, "Wikidata")
                  ? "Identité résolue via Wikidata"
                  : "Identité en attente de vérification"}
              </h2>
              <div className="summary-counts">
                {[
                  ["Œuvres", data?.stats.works],
                  ["Enregistrements", data?.stats.recordings],
                  ["Sorties", data?.stats.releases],
                  ["Anomalies", data?.stats.anomalies],
                ].map(([label, value]) => (
                  <span key={String(label)}>
                    <strong>{nombre(typeof value === "number" ? value : undefined)}</strong>
                    {label}
                  </span>
                ))}
              </div>
            </div>
            <Button asChild size="lg">
              <Link to="/artiste/senbei">
                Ouvrir le référentiel
                <ArrowRight />
              </Link>
            </Button>
          </section>
        )}
      </main>
    </Shell>
  );
}
