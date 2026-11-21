import { useEffect, useRef, useState } from "react";
import * as PopoverPrimitive from "@radix-ui/react-popover";
import { ArrowRight, ArrowUpRight, TriangleAlert } from "lucide-react";
import type { ChampDivergent as Champ } from "@/lib/fiabilite";

// Hover and focus open the bubble. It is rendered next to its trigger, without a portal,
// so Tab walks from the field into its links; Enter or the down arrow jumps there directly.
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
  // Escape gives focus back to the trigger; that focus must not reopen the bubble.
  const ignorerFocus = useRef(false);
  const annuler = () => window.clearTimeout(fermeture.current);
  const fermerBientot = () => {
    annuler();
    fermeture.current = window.setTimeout(() => {
      if (!contenu.current?.contains(document.activeElement)) setOpen(false);
    }, 160);
  };
  useEffect(() => annuler, []);
  const dedans = (element: EventTarget | null) =>
    element instanceof Node &&
    Boolean(contenu.current?.contains(element) || declencheur.current?.contains(element));
  const entrer = () => {
    setOpen(true);
    window.requestAnimationFrame(() =>
      contenu.current?.querySelector<HTMLElement>("a, button")?.focus(),
    );
  };
  const id = `divergent-${champ.field}`;
  return (
    <PopoverPrimitive.Root open={open} onOpenChange={setOpen}>
      <PopoverPrimitive.Anchor asChild>
        <button
          ref={declencheur}
          type="button"
          className="divergent-field"
          aria-expanded={open}
          aria-controls={open ? id : undefined}
          aria-describedby={open ? `${id}-hint ${id}` : `${id}-hint`}
          onPointerEnter={() => {
            annuler();
            setOpen(true);
          }}
          onPointerLeave={fermerBientot}
          onFocus={() => {
            if (ignorerFocus.current) ignorerFocus.current = false;
            else setOpen(true);
          }}
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
      </PopoverPrimitive.Anchor>
      <PopoverPrimitive.Content
        ref={contenu}
        id={id}
        className="divergent-popover z-50 rounded-md border bg-popover text-popover-foreground shadow-md outline-none"
        side="right"
        align="start"
        sideOffset={6}
        onOpenAutoFocus={(event) => event.preventDefault()}
        onCloseAutoFocus={(event) => event.preventDefault()}
        onEscapeKeyDown={() => {
          if (document.activeElement !== declencheur.current) {
            ignorerFocus.current = true;
            declencheur.current?.focus();
          }
        }}
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
      </PopoverPrimitive.Content>
    </PopoverPrimitive.Root>
  );
}
