import { CircleAlert, CircleCheck, CircleX, Info } from "lucide-react";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { niveauxJauge, pourcentageFr, type Jauge, type NiveauJauge } from "@/lib/fiabilite";
import { nombre } from "@/lib/libelles";

const RAYON = 34;
const CIRCONFERENCE = 2 * Math.PI * RAYON;
const icones: Record<NiveauJauge, typeof CircleCheck> = {
  bon: CircleCheck,
  surveiller: CircleAlert,
  faible: CircleX,
};

function Anneau({ jauge }: { jauge: Jauge }) {
  const reste = CIRCONFERENCE * (1 - Math.min(Math.max(jauge.pourcentage, 0), 100) / 100);
  return (
    <svg className="gauge-ring" viewBox="0 0 84 84" aria-hidden="true">
      <circle className="gauge-track" cx="42" cy="42" r={RAYON} />
      <circle
        className="gauge-value"
        cx="42"
        cy="42"
        r={RAYON}
        strokeDasharray={CIRCONFERENCE}
        strokeDashoffset={reste}
        style={
          {
            "--gauge-full": CIRCONFERENCE,
            "--gauge-offset": reste,
          } as React.CSSProperties
        }
      />
      <text className="gauge-percent" x="42" y="47" textAnchor="middle">
        {pourcentageFr(jauge.pourcentage)}
      </text>
    </svg>
  );
}

export function Jauges({ jauges }: { jauges: Jauge[] }) {
  if (!jauges.length) return null;
  return (
    <section className="gauges" aria-label="Fiabilité du référentiel">
      {jauges.map((jauge) => {
        const Icone = icones[jauge.niveau];
        return (
          <Tooltip key={jauge.id}>
            <TooltipTrigger asChild>
              <div
                className={`gauge gauge-${jauge.niveau}`}
                tabIndex={0}
                role="group"
                aria-label={`${jauge.libelle} : ${pourcentageFr(jauge.pourcentage)}, ${nombre(jauge.numerateur)} sur ${nombre(jauge.denominateur)}, ${niveauxJauge[jauge.niveau]}`}
              >
                <Anneau jauge={jauge} />
                <div className="gauge-body">
                  <span className="gauge-label">
                    {jauge.libelle}
                    <Info size={12} aria-hidden="true" />
                  </span>
                  <span className="gauge-detail">{jauge.detail}</span>
                  <span className="gauge-level">
                    <Icone size={13} aria-hidden="true" />
                    {niveauxJauge[jauge.niveau]}
                  </span>
                </div>
              </div>
            </TooltipTrigger>
            <TooltipContent className="gauge-tooltip">{jauge.explication}</TooltipContent>
          </Tooltip>
        );
      })}
    </section>
  );
}
