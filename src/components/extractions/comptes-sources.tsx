import { useState } from "react";
import { ArrowUpRight, LoaderCircle, RotateCcw } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { acceptAccount, rejectAccount, waitJob, type SourceAccount } from "@/lib/backend";
import { estAlias, methodeLien, nomSource } from "@/lib/extraction-libelles";
import type { SetAside } from "@/lib/referentiel";
import type { Revue } from "@/hooks/use-revue";

/** Compte mis de côté : proposé (à vérifier) ou refusé par un membre du label. */
interface MisDeCote {
  link_id: number;
  source: string;
  name: string;
  url: string | null;
  status: string;
  reason: string | null;
  score: number | null;
}

type Choix = { type: "retirer" | "reintegrer"; linkId: number; source: string; name: string };

interface ComptesSourcesProps {
  comptes: SourceAccount[];
  setAside: SetAside[];
  revue: Revue;
  /** Appelé après réintégration : une collecte complète est lancée, la page doit suivre son job. */
  onCollecte: () => void;
}

/**
 * Comptes retenus et comptes mis de côté d’un artiste. Aucune action n’est exécutée sans confirmation.
 * Les comptes proposés viennent de `v_artist_sources` ; les comptes refusés, absents de cette vue, viennent
 * de `meta.set_aside` du référentiel.
 */
export function ComptesSources({
  comptes: tousLesComptes,
  setAside,
  revue,
  onCollecte,
}: ComptesSourcesProps) {
  const [choix, setChoix] = useState<Choix | null>(null);
  // Les autres noms (alias) ont leur propre section : jamais en double ici.
  const comptes = tousLesComptes.filter((c) => !estAlias(c.method));
  const retenus = comptes.filter((c) => c.link_status === "validated");

  const misDeCote = new Map<number, MisDeCote>();
  for (const c of comptes) {
    if (c.link_status !== "proposed") continue;
    misDeCote.set(c.link_id, {
      link_id: c.link_id,
      source: c.source,
      name: c.name,
      url: c.url,
      status: "proposed",
      reason: c.reason ?? null,
      score: c.score ?? null,
    });
  }
  for (const s of setAside) {
    if (misDeCote.has(s.link_id)) continue;
    misDeCote.set(s.link_id, {
      link_id: s.link_id,
      source: s.source,
      name: s.name,
      url: s.url ?? null,
      status: s.status,
      reason: s.reason ?? null,
      score: s.score ?? null,
    });
  }
  const mis = [...misDeCote.values()];
  const busy = revue.enCours !== null;

  async function confirmer() {
    const c = choix;
    if (!c) return;
    setChoix(null);
    if (c.type === "retirer") {
      await revue.lancer("Retrait du compte en cours…", async () => {
        const job = await waitJob(await rejectAccount(c.linkId));
        if (job.status === "error") {
          throw new Error(job.error?.split("\n")[0] ?? "Le retrait du compte a échoué.");
        }
      });
    } else {
      await revue.lancer("Réintégration du compte en cours…", async () => {
        await acceptAccount(c.linkId);
        onCollecte();
      });
    }
  }

  return (
    <>
      <section className="mt-10" aria-labelledby="comptes-title">
        <h2 id="comptes-title" className="mb-3 text-lg font-semibold">
          Comptes retenus
        </h2>
        {retenus.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun compte retenu.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {retenus.map((acc) => (
              <li key={acc.link_id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{nomSource(acc.source)}</strong> — {acc.name}
                  <Badge variant="outline">vérifié</Badge>
                </div>
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
                <Button
                  variant="link"
                  size="sm"
                  className="h-auto p-0 text-xs"
                  disabled={busy}
                  onClick={() =>
                    setChoix({
                      type: "retirer",
                      linkId: acc.link_id,
                      source: acc.source,
                      name: acc.name,
                    })
                  }
                >
                  Ce n’est pas mon artiste
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <section className="mt-10" aria-labelledby="mis-de-cote-title">
        <h2 id="mis-de-cote-title" className="mb-3 text-lg font-semibold">
          Mis de côté{" "}
          {mis.length > 0 && <span className="text-muted-foreground">({mis.length})</span>}
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Ces comptes n’alimentent ni le catalogue ni le référentiel. Une ressemblance de nom n’est
          pas une preuve : c’est à vous de trancher.
        </p>
        {mis.length === 0 ? (
          <p className="text-sm text-muted-foreground">Aucun compte mis de côté.</p>
        ) : (
          <ul className="grid gap-2 sm:grid-cols-2">
            {mis.map((m) => (
              <li key={m.link_id} className="rounded-lg border p-3 text-sm">
                <div className="flex flex-wrap items-center gap-2">
                  <strong>{nomSource(m.source)}</strong> — {m.name}
                  <Badge variant="outline">
                    {m.status === "rejected" ? "refusé" : "à vérifier"}
                  </Badge>
                </div>
                {m.url && (
                  <a
                    href={m.url}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center underline"
                  >
                    voir <ArrowUpRight size={12} />
                  </a>
                )}
                <div className="mt-1 text-xs text-muted-foreground">
                  {m.reason ??
                    (m.status === "rejected"
                      ? "Refusé par un membre du label."
                      : "Raison non renseignée.")}
                  {m.score != null && ` · cohérence ${Math.round(m.score * 100)} %`}
                </div>
                <Button
                  variant="link"
                  size="sm"
                  className="mt-1 h-auto p-0 text-xs"
                  disabled={busy}
                  onClick={() =>
                    setChoix({
                      type: "reintegrer",
                      linkId: m.link_id,
                      source: m.source,
                      name: m.name,
                    })
                  }
                >
                  <RotateCcw size={12} /> C’est bien lui
                </Button>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AlertDialog open={choix !== null} onOpenChange={(open) => !open && setChoix(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {choix?.type === "retirer" ? "Retirer ce compte ?" : "Réintégrer ce compte ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {choix?.type === "retirer"
                ? `Le compte « ${choix.name} » (${nomSource(choix.source)}) ne sera plus utilisé : son catalogue sera retiré et le référentiel recalculé. Vous pourrez le réintégrer depuis « Mis de côté ».`
                : `Le compte « ${choix?.name ?? ""} » (${nomSource(choix?.source ?? "")}) sera réintégré et une collecte complète sera relancée.`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmer()}>
              {choix?.type === "retirer" ? "Retirer ce compte" : "Réintégrer ce compte"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** État de la dernière action de revue : en cours ou erreur. */
export function RevueEtat({ revue }: { revue: Revue }) {
  if (revue.enCours) {
    return (
      <p role="status" className="mt-6 flex items-center gap-2 text-sm text-muted-foreground">
        <LoaderCircle className="animate-spin" size={16} /> {revue.enCours}
      </p>
    );
  }
  if (revue.erreur) {
    return (
      <p role="alert" className="mt-6 text-sm text-destructive">
        {revue.erreur}
      </p>
    );
  }
  return null;
}
