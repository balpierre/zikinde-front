import { Link } from "@tanstack/react-router";
import { Button } from "@/components/ui/button";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import { organizationSearch } from "@/lib/backend";
import { PERIMETRES, estPerimetre, type PerimetreLabel } from "@/lib/label";

/** Filtre Mon label / Autres labels / Inconnu / Tout. Le choix est porté par l’URL (`?perimetre=`). */
export function FiltrePerimetre({
  valeur,
  onChange,
}: {
  valeur: PerimetreLabel;
  onChange: (perimetre: PerimetreLabel) => void;
}) {
  return (
    <div className="flex flex-wrap items-center gap-3 text-sm">
      <span className="text-muted-foreground">Périmètre</span>
      <ToggleGroup
        type="single"
        variant="outline"
        size="sm"
        value={valeur}
        aria-label="Filtrer par label"
        className="flex-wrap justify-start"
        onValueChange={(v) => {
          if (estPerimetre(v)) onChange(v);
        }}
      >
        {PERIMETRES.map(({ value, label }) => (
          <ToggleGroupItem key={value} value={value} aria-label={label}>
            {label}
          </ToggleGroupItem>
        ))}
      </ToggleGroup>
    </div>
  );
}

/** Invite affichée tant que le label n’a pas de profil. */
export function BandeauProfilLabel({ orgId }: { orgId: string | undefined }) {
  return (
    <div className="data-notice mb-6" role="status">
      <span className="status-dot" />
      <div>
        <strong>Renseignez votre label pour filtrer votre catalogue</strong>
        <p>
          Noms, préfixes UPC et codes ISRC de votre label permettent de séparer votre catalogue de
          celui des autres labels.
        </p>
        <Button variant="link" asChild className="h-auto px-0">
          <Link to="/label" search={organizationSearch({ label: orgId })}>
            Renseigner mon label
          </Link>
        </Button>
      </div>
    </div>
  );
}
