import { useEffect, useRef, useState } from "react";
import { ArrowRight, ArrowUpRight, TriangleAlert } from "lucide-react";
import { Popover, PopoverAnchor, PopoverContent } from "@/components/ui/popover";
import type { ChampDivergent as Champ } from "@/lib/fiabilite";

// Hover and focus open the bubble; Enter or the down arrow moves into it so its links stay reachable.
export function ChampDivergent({
  champ,
  onOpenAnomaly,
}: {
  champ: Champ;
  onOpenAnomaly: (id: string) => void;
}) {
  const [open, setOpen] = useState(false);
  const declencheur = useRef<HTMLButtonElement>(null);
  const contenu = useRef<HTMLDivElement>(null);
  const fermeture = useRef<number | undefined>(undefined);
  const annuler = () => window.clearTimeout(fermeture.current);
  const fermerBientot = () => {
    annuler();
    fermeture.current = window.setTimeout(() => setOpen(false), 160);
  };
  useEffect(() => annuler, []);
  const dedans = (element: EventTarget | null) =>
    element instanceof Node &&
    (contenu.current?.contains(element) || declencheur.current?.contains(element));
  const entrer = () => {
    setOpen(true);
    window.requestAnimationFrame(() =>
      contenu.current?.querySelector<HTMLElement>("a, button")?.focus(),
    );
  };
  const id = `divergent-${champ.field}`;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverAnchor asChild>
        <button
          ref={declencheur}
          type="button"
          className="divergent-field"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          aria-describedby={`${id}-hint`}
          onPointerEnter={() => {
            annuler();
            setOpen(true);
          }}
          onPointerLeave={fermerBientot}
          onFocus={() => setOpen(true)}
          onBlur={(event) => {
            if (!dedans(event.relatedTarget)) setOpen(false);
          }}
          onClick={entrer}
          onKeyDown={(event) => {
            if (event.key === "ArrowDown") {
              event.preventDefault();
              entrer();
            }
          }}
        >
          <span className="divergent-label">{champ.libelle}</span>
          <TriangleAlert size={12} aria-hidden="true" />
          <span id={`${id}-hint`} className="sr-only">
            Valeurs divergentes entre les sources
          </span>
        </button>
      </PopoverAnchor>
      <PopoverContent
        ref={contenu}
        id={id}
        className="divergent-popover"
        side="right"
        align="start"
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={() => declencheur.current?.focus()}
        onInteractOutside={(event) => {
          if (dedans(event.target)) event.preventDefault();
        }}
        onPointerEnter={annuler}
        onPointerLeave={fermerBientot}
        onBlur={(event) => {
          if (!dedans(event.relatedTarget)) setOpen(false);
        }}
      >
        <p className="divergent-title">
          <TriangleAlert size={13} aria-hidden="true" />
          {champ.libelle} : les sources divergent
        </p>
        <ul className="divergent-values">
          {champ.valeurs.map((v, index) => (
            <li key={`${v.source}-${index}`}>
              <span className="divergent-source">{v.source}</span>
              <span className="divergent-value">{v.valeur}</span>
              {/^https?:\/\//.test(v.lien) && (
                <a
                  href={v.lien}
                  target="_blank"
                  rel="noreferrer"
                  aria-label={`Voir ${v.source} (nouvel onglet)`}
                >
                  <ArrowUpRight size={12} />
                </a>
              )}
            </li>
          ))}
        </ul>
        {champ.anomalie && (
          <button
            type="button"
            className="divergent-anomaly"
            onClick={() => {
              setOpen(false);
              if (champ.anomalie) onOpenAnomaly(champ.anomalie.id);
            }}
          >
            Voir l’anomalie
            <ArrowRight size={12} aria-hidden="true" />
          </button>
        )}
      </PopoverContent>
    </Popover>
  );
}
