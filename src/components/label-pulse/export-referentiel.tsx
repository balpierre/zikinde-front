import { Download } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import {
  affirmationsCsv,
  noeudsCsv,
  referentielJson,
  relationsCsv,
  typesExportables,
} from "@/lib/exports";
import { mentionLectureSeule, nombre, typesNoeudsPluriel } from "@/lib/libelles";
import type { Referentiel } from "@/lib/referentiel";
import { TYPE_CSV, TYPE_JSON, nomFichier, telecharger } from "@/lib/telechargement";

export function ExportReferentiel({ data }: { data: Referentiel }) {
  const artiste = data.meta.artist_name ?? "artiste";
  const csv = (objet: string, contenu: () => string) =>
    telecharger(nomFichier(artiste, objet, "csv", new Date()), contenu(), TYPE_CSV);
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" size="sm" className="export-trigger">
          <Download /> Exporter le référentiel
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="export-menu">
        <DropdownMenuItem
          onSelect={() => {
            const now = new Date();
            telecharger(
              nomFichier(artiste, "referentiel", "json", now),
              referentielJson(data, now.toISOString()),
              TYPE_JSON,
            );
          }}
        >
          JSON complet, avec provenance
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <DropdownMenuLabel>CSV par type d’objet</DropdownMenuLabel>
        {typesExportables.map((type) => {
          const count = data.nodes.filter((n) => n.type === type).length;
          const libelle = typesNoeudsPluriel[type] ?? type;
          const fichier = libelle
            .normalize("NFD")
            .replace(/[\u0300-\u036f]/g, "")
            .replace("Œ", "Oe")
            .toLowerCase();
          return (
            <DropdownMenuItem
              key={type}
              disabled={!count}
              onSelect={() => csv(fichier, () => noeudsCsv(data, type))}
            >
              {libelle} <span className="export-count">{nombre(count)}</span>
            </DropdownMenuItem>
          );
        })}
        <DropdownMenuItem onSelect={() => csv("relations", () => relationsCsv(data))}>
          Relations <span className="export-count">{nombre(data.edges.length)}</span>
        </DropdownMenuItem>
        <DropdownMenuItem onSelect={() => csv("affirmations", () => affirmationsCsv(data))}>
          Affirmations <span className="export-count">{nombre(data.claims.length)}</span>
        </DropdownMenuItem>
        <DropdownMenuSeparator />
        <p className="export-notice">{mentionLectureSeule}</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
