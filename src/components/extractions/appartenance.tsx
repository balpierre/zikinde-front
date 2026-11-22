import { Badge } from "@/components/ui/badge";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { libellePreuve, type Appartenance, type StatutAppartenance } from "@/lib/label";

const libelles: Record<StatutAppartenance, string> = {
  client: "Mon label",
  other: "Autre label",
  unknown: "Label inconnu",
};

/** Badge d’appartenance d’une sortie ou d’un titre ; les preuves apparaissent au survol. Rien sans profil. */
export function BadgeAppartenance({
  appartenance,
  renseigne,
}: {
  appartenance: Appartenance;
  renseigne: boolean;
}) {
  if (!renseigne) return null;
  const { statut, preuves } = appartenance;
  const badge = (
    <Badge
      variant={statut === "client" ? "default" : statut === "other" ? "outline" : "secondary"}
      className="whitespace-nowrap"
    >
      {libelles[statut]}
    </Badge>
  );
  if (!preuves.length) return badge;
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <span tabIndex={0} className="inline-flex">
          {badge}
        </span>
      </TooltipTrigger>
      <TooltipContent>
        <p className="mb-1 font-medium">Preuves</p>
        <ul className="grid gap-0.5">
          {preuves.map((p, i) => (
            <li key={i}>{libellePreuve(p)}</li>
          ))}
        </ul>
      </TooltipContent>
    </Tooltip>
  );
}
