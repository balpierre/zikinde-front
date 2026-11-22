import { ArrowRight, Waves } from "lucide-react";
import {
  largeurIceberg,
  syntheseIceberg,
  type CoucheIceberg,
  type TypeCouche,
} from "@/lib/fiabilite";
import { nombre } from "@/lib/libelles";

const destinations: Record<TypeCouche, string> = {
  release: "Ouvrir le graphe filtré sur les sorties",
  recording: "Ouvrir le graphe filtré sur les enregistrements",
  work: "Ouvrir la généalogie des œuvres",
};

function Forme({ largeur, type }: { largeur: number; type: TypeCouche }) {
  const demi = largeur * 50;
  // Tapered sides suggest the ice mass without changing the measured width.
  const retrait = Math.min(demi * 0.18, 6);
  const points =
    type === "release"
      ? `${50 - demi + retrait},2 ${50 + demi - retrait},2 ${50 + demi},38 ${50 - demi},38`
      : `${50 - demi},2 ${50 + demi},2 ${50 + demi - retrait},38 ${50 - demi + retrait},38`;
  return (
    <svg
      className="iceberg-shape"
      viewBox="0 0 100 40"
      preserveAspectRatio="none"
      aria-hidden="true"
    >
      <polygon points={points} />
    </svg>
  );
}

function Couche({
  couche,
  maximum,
  onOuvrir,
}: {
  couche: CoucheIceberg;
  maximum: number;
  onOuvrir: (type: TypeCouche) => void;
}) {
  return (
    <button
      type="button"
      className={`iceberg-layer ${couche.type}`}
      onClick={() => onOuvrir(couche.type)}
      aria-label={`${nombre(couche.nombre)} ${couche.libelle.toLowerCase()}, identifiant ${couche.identifiant}, ${couche.droits.toLowerCase()}${couche.type === "work" ? `, dont ${nombre(couche.avecIdentifiant)} avec ${couche.identifiant}` : ""}. ${destinations[couche.type]}`}
    >
      <Forme largeur={largeurIceberg(couche.nombre, maximum)} type={couche.type} />
      <span className="iceberg-meta">
        <strong>
          {nombre(couche.nombre)} <span>{couche.libelle.toLowerCase()}</span>
        </strong>
        <span className="iceberg-tags">
          <span className="mono">{couche.identifiant}</span>
          <span>{couche.droits}</span>
        </span>
        {couche.type === "work" && (
          <span className="iceberg-sub">
            dont {nombre(couche.avecIdentifiant)} avec {couche.identifiant}
          </span>
        )}
      </span>
      <ArrowRight className="iceberg-arrow" size={15} aria-hidden="true" />
    </button>
  );
}

export function Iceberg({
  couches,
  onOuvrir,
}: {
  couches: CoucheIceberg[];
  onOuvrir: (type: TypeCouche) => void;
}) {
  const maximum = Math.max(0, ...couches.map((c) => c.nombre));
  if (!maximum) return null;
  const surface = couches.filter((c) => c.visible);
  const fond = couches.filter((c) => !c.visible);
  const synthese = syntheseIceberg(couches);
  return (
    <figure className="iceberg" aria-label="Le catalogue en trois couches">
      <div className="iceberg-surface">
        {surface.map((c) => (
          <Couche key={c.type} couche={c} maximum={maximum} onOuvrir={onOuvrir} />
        ))}
      </div>
      <div className="iceberg-waterline" role="separator">
        <Waves size={14} aria-hidden="true" />
        <span>Ligne de flottaison : au-dessus, ce que le public voit ; en dessous, les droits</span>
      </div>
      <div className="iceberg-depth">
        {fond.map((c) => (
          <Couche key={c.type} couche={c} maximum={maximum} onOuvrir={onOuvrir} />
        ))}
      </div>
      {synthese && <figcaption className="iceberg-summary">{synthese}</figcaption>}
    </figure>
  );
}
