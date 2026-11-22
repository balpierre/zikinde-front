import { useState, type ReactNode } from "react";
import { ArrowUpRight, RotateCcw } from "lucide-react";
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
import { decideAlias, waitJob } from "@/lib/backend";
import { nomSource } from "@/lib/extraction-libelles";
import type { Alias } from "@/lib/referentiel";
import type { Revue } from "@/hooks/use-revue";

type Decision = "validated" | "rejected";
type Choix = { decision: Decision; alias: Alias };

interface AutresNomsProps {
  aliases: Alias[];
  revue: Revue;
  /** Appelé après validation : une collecte complète est lancée, la page doit suivre son job. */
  onCollecte: () => void;
}

/**
 * Autres noms de l’artiste (alias, projets) déclarés par les sources. Un alias est toujours proposé :
 * c’est au label de le retenir ou de le refuser. Section masquée s’il n’y en a aucun.
 */
export function AutresNoms({ aliases, revue, onCollecte }: AutresNomsProps) {
  const [choix, setChoix] = useState<Choix | null>(null);
  if (aliases.length === 0) return null;

  const busy = revue.enCours !== null;
  const proposes = aliases.filter((a) => a.status === "proposed");
  const retenus = aliases.filter((a) => a.status === "validated");
  const refuses = aliases.filter((a) => a.status === "rejected");

  async function confirmer() {
    const c = choix;
    if (!c) return;
    setChoix(null);
    if (c.decision === "validated") {
      await revue.lancer("Validation de l’autre nom en cours…", async () => {
        await decideAlias(c.alias.link_id, "validated");
        onCollecte();
      });
    } else {
      await revue.lancer("Refus de l’autre nom en cours…", async () => {
        const job = await waitJob(await decideAlias(c.alias.link_id, "rejected"));
        if (job.status === "error") {
          throw new Error(job.error?.split("\n")[0] ?? "Le refus de cet autre nom a échoué.");
        }
      });
    }
  }

  function carte(a: Alias, badge: string, action: Action) {
    const { secondaire } = action;
    return (
      <li key={a.link_id} className="rounded-lg border p-3 text-sm">
        <div className="flex flex-wrap items-center gap-2">
          <strong>{nomSource(a.source)}</strong> — {a.name}
          <Badge variant="outline">{badge}</Badge>
        </div>
        {a.url && (
          <a
            href={a.url}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center underline"
          >
            voir <ArrowUpRight size={12} />
          </a>
        )}
        <div className="mt-1 text-xs text-muted-foreground">
          {a.reason ?? "Autre nom déclaré par la source."}
        </div>
        <Button
          variant="link"
          size="sm"
          className="mt-1 h-auto p-0 text-xs"
          disabled={busy}
          onClick={() => setChoix({ decision: action.decision, alias: a })}
        >
          {action.icone}
          {action.libelle}
        </Button>
        {secondaire && (
          <Button
            variant="link"
            size="sm"
            className="mt-1 h-auto p-0 text-xs"
            disabled={busy}
            onClick={() => setChoix({ decision: secondaire.decision, alias: a })}
          >
            {secondaire.libelle}
          </Button>
        )}
      </li>
    );
  }

  return (
    <>
      <section className="mt-10" aria-labelledby="autres-noms-title">
        <h2 id="autres-noms-title" className="mb-3 text-lg font-semibold">
          Autres noms <span className="text-muted-foreground">({aliases.length})</span>
        </h2>
        <p className="mb-3 text-sm text-muted-foreground">
          Alias, projets ou comptes déclarés par les sources comme appartenant à cet artiste. Un
          autre nom n’est retenu qu’après votre validation : son catalogue rejoint alors celui de
          l’artiste.
        </p>

        {proposes.length > 0 && (
          <>
            <h3 className="mb-2 text-sm font-medium">À vérifier</h3>
            <ul className="mb-4 grid gap-2 sm:grid-cols-2">
              {proposes.map((a) =>
                carte(a, "à vérifier", {
                  decision: "validated",
                  libelle: "C’est lui",
                  icone: <RotateCcw size={12} />,
                  secondaire: { decision: "rejected", libelle: "Ce n’est pas lui" },
                }),
              )}
            </ul>
          </>
        )}

        {retenus.length > 0 && (
          <>
            <h3 className="mb-2 text-sm font-medium">Retenus</h3>
            <ul className="mb-4 grid gap-2 sm:grid-cols-2">
              {retenus.map((a) =>
                carte(a, "validé", {
                  decision: "rejected",
                  libelle: "Ce n’est pas lui",
                }),
              )}
            </ul>
          </>
        )}

        {proposes.length === 0 && retenus.length === 0 && (
          <p className="mb-4 text-sm text-muted-foreground">Aucun autre nom à vérifier.</p>
        )}

        {refuses.length > 0 && (
          <details className="text-sm">
            <summary className="cursor-pointer text-muted-foreground">
              Refusés ({refuses.length})
            </summary>
            <ul className="mt-2 grid gap-2 sm:grid-cols-2">
              {refuses.map((a) =>
                carte(a, "refusé", {
                  decision: "validated",
                  libelle: "C’est bien lui",
                  icone: <RotateCcw size={12} />,
                }),
              )}
            </ul>
          </details>
        )}
      </section>

      <AlertDialog open={choix !== null} onOpenChange={(open) => !open && setChoix(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>
              {choix?.decision === "validated"
                ? "Retenir cet autre nom ?"
                : "Refuser cet autre nom ?"}
            </AlertDialogTitle>
            <AlertDialogDescription>
              {choix?.decision === "validated"
                ? `L’autre nom « ${choix.alias.name} » (${nomSource(choix.alias.source)}) sera retenu : son catalogue rejoindra celui de l’artiste et une collecte complète sera relancée.`
                : `« ${choix?.alias.name ?? ""} » (${nomSource(choix?.alias.source ?? "")}) ne sera pas retenu : son catalogue n’entrera pas dans celui de l’artiste. Vous pourrez revenir sur ce choix depuis « Refusés ».`}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Annuler</AlertDialogCancel>
            <AlertDialogAction onClick={() => void confirmer()}>
              {choix?.decision === "validated" ? "Retenir cet autre nom" : "Refuser cet autre nom"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </>
  );
}

/** Bouton d’une carte : sa décision, et une décision secondaire optionnelle. */
interface Action {
  decision: Decision;
  libelle: string;
  icone?: ReactNode;
  secondaire?: { decision: Decision; libelle: string };
}
