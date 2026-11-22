import { useState } from "react";

/** Nombre de variantes affichées avant le bouton « voir tout ». */
const LIMITE_VISIBLE = 8;

/** Ligne « Aussi connu sous : … » sous le nom de l’artiste. Rien n’est affiché sans variante. */
export function AussiConnuSous({ noms }: { noms: string[] }) {
  const [toutAffiche, setToutAffiche] = useState(false);
  if (noms.length === 0) return null;

  const visibles = toutAffiche ? noms : noms.slice(0, LIMITE_VISIBLE);
  return (
    <div className="mt-2 text-sm text-muted-foreground">
      Aussi connu sous : {visibles.join(", ")}
      {noms.length > LIMITE_VISIBLE && (
        <>
          {" · "}
          <button type="button" className="underline" onClick={() => setToutAffiche((v) => !v)}>
            {toutAffiche ? "voir moins" : `voir tout (${noms.length})`}
          </button>
        </>
      )}
    </div>
  );
}
