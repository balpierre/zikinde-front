import { useState } from "react";
import { ChevronLeft, ChevronRight, Copy, FilePenLine, Info } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  raccourcir,
  titresDistincts,
  type CasIsrcDouble,
  type EnregistrementCas,
} from "@/lib/fiabilite";
import { dureeCourte, nombre } from "@/lib/libelles";

function CarteEnregistrement({ enregistrement }: { enregistrement: EnregistrementCas }) {
  return (
    <div className="isrc-recording">
      <strong>{enregistrement.titre}</strong>
      <span className="isrc-code mono">{enregistrement.isrc}</span>
      <span className="isrc-duration">{dureeCourte(enregistrement.dureeS)}</span>
      {enregistrement.sorties.length ? (
        <div className="isrc-releases">
          <span>
            {enregistrement.sorties.length > 1
              ? "Sorties qui le contiennent"
              : "Sortie qui le contient"}
          </span>
          <ul>
            {enregistrement.sorties.map((sortie) => (
              <li key={sortie}>{sortie}</li>
            ))}
          </ul>
        </div>
      ) : (
        <span className="isrc-releases-empty">Sorties non renseignées</span>
      )}
    </div>
  );
}

export function IsrcDouble({
  cas,
  onCorriger,
}: {
  cas: CasIsrcDouble[];
  onCorriger: (anomalie: string) => void;
}) {
  const [index, setIndex] = useState(0);
  const courant = cas[Math.min(index, cas.length - 1)];
  if (!courant) return null;
  const [premier, second] = courant.enregistrements;
  const titres = titresDistincts(cas);
  return (
    <section className="isrc-double" aria-labelledby="isrc-double-titre">
      <div className="isrc-double-heading">
        <div>
          <span className="isrc-double-eyebrow">
            <Copy size={13} aria-hidden="true" />
            {nombre(titres)} titre{titres > 1 ? "s" : ""} concerné{titres > 1 ? "s" : ""}
          </span>
          <h2 id="isrc-double-titre">Le même morceau, deux codes</h2>
          <p>{raccourcir(courant.anomalie.description)}</p>
        </div>
        {cas.length > 1 && (
          <div className="isrc-double-nav">
            <Button
              variant="outline"
              size="icon"
              aria-label="Cas précédent"
              onClick={() => setIndex((i) => (i - 1 + cas.length) % cas.length)}
            >
              <ChevronLeft />
            </Button>
            <span className="mono" aria-live="polite" aria-atomic="true">
              <span className="sr-only">Cas </span>
              {nombre(index + 1)} / {nombre(cas.length)}
            </span>
            <Button
              variant="outline"
              size="icon"
              aria-label="Cas suivant"
              onClick={() => setIndex((i) => (i + 1) % cas.length)}
            >
              <ChevronRight />
            </Button>
          </div>
        )}
      </div>
      <div className="isrc-double-pair">
        <CarteEnregistrement enregistrement={premier} />
        <div className="isrc-double-versus">
          <span className="isrc-not-equal" aria-hidden="true">
            ≠
          </span>
          <span className="sr-only">ISRC différents pour</span>
          <span>même titre · même durée</span>
        </div>
        <CarteEnregistrement enregistrement={second} />
      </div>
      <div className="isrc-double-footer">
        <p className="isrc-double-note">
          <Info size={12} aria-hidden="true" />
          Une réédition sous licence peut justifier un nouvel ISRC : c’est au label de trancher.
        </p>
        <Button onClick={() => onCorriger(courant.anomalie.id)}>
          <FilePenLine />
          Préparer la correction
        </Button>
      </div>
    </section>
  );
}
