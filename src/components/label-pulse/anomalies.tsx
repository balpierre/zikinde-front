import { useEffect, useRef, useState } from "react";
import {
  ArrowLeft,
  ArrowRight,
  ArrowUpRight,
  CircleAlert,
  Download,
  EyeOff,
  FilePen,
  ListChecks,
  RotateCcw,
  Sparkles,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { LectureSeule, SourceBadge } from "./shared";
import {
  DESTINATAIRES,
  ETATS_LOCAUX,
  GRAVITES,
  brouillonInitial,
  demandeCorrection,
  demandesPreparees,
  etapesDestinataires,
  etatLocal,
  filtrerAnomalies,
  filtresParDefaut,
  ignoreeSchema,
  referenceSchema,
  texteObservation,
  type Brouillon,
  type Decision,
  type Decisions,
  type Destinataire,
  type FiltresAnomalies,
} from "@/lib/anomalies";
import { demandesCsv, demandesJson } from "@/lib/exports";
import { explicationDemo } from "@/lib/explication-ia";
import {
  dateFr,
  destinataires,
  etatsLocaux,
  gravites,
  libelleChamp,
  libelleColonneElement,
  libelleTypeAnomalie,
  nombre,
  statutsSource,
  valeurElement,
} from "@/lib/libelles";
import type { Anomaly, Referentiel } from "@/lib/referentiel";
import { TYPE_CSV, TYPE_JSON, nomFichier, telecharger } from "@/lib/telechargement";

const ELEMENTS_AFFICHES = 20;
type Modifier = (id: string, change: (decision: Decision) => Decision) => void;

function exporterDemandes(
  artiste: string,
  demandes: ReturnType<typeof demandesPreparees>,
  format: "json" | "csv",
  objet = "demandes-de-correction",
) {
  const now = new Date();
  if (format === "json")
    telecharger(
      nomFichier(artiste, objet, "json", now),
      demandesJson(demandes, now.toISOString()),
      TYPE_JSON,
    );
  else telecharger(nomFichier(artiste, objet, "csv", now), demandesCsv(demandes), TYPE_CSV);
}
function MarqueGravite({ severity }: { severity: string | undefined }) {
  return (
    <span className={`severity-mark severity-${severity ?? "inconnue"}`}>
      {gravites[severity ?? ""] ?? "Gravité non renseignée"}
    </span>
  );
}
function MarqueEtat({ decision }: { decision: Decision | undefined }) {
  const etat = etatLocal(decision);
  return <span className={`local-state state-${etat}`}>{etatsLocaux[etat]}</span>;
}
function Etapes({ target }: { target: string | undefined }) {
  const etapes = etapesDestinataires(target);
  return etapes.length ? (
    <ol className="recipient-steps">
      {etapes.map((d, i) => (
        <li key={d}>
          <span className="mono">{i + 1}</span>
          {destinataires[d]}
        </li>
      ))}
    </ol>
  ) : (
    <p className="anomaly-muted">Destinataire non renseigné.</p>
  );
}
function TableElements({ items }: { items: Record<string, unknown>[] }) {
  const [tout, setTout] = useState(false);
  const colonnes = [...new Set(items.flatMap((item) => Object.keys(item)))].filter(
    (key) => key !== "url",
  );
  const avecLien = items.some((item) => typeof item["url"] === "string");
  const lignes = tout ? items : items.slice(0, ELEMENTS_AFFICHES);
  return (
    <>
      <div className="matrix-scroll">
        <table className="anomaly-items">
          <thead>
            <tr>
              {colonnes.map((key) => (
                <th key={key} scope="col">
                  {libelleColonneElement(key)}
                </th>
              ))}
              {avecLien && <th scope="col">Lien</th>}
            </tr>
          </thead>
          <tbody>
            {lignes.map((item, index) => (
              <tr key={index}>
                {colonnes.map((key) => (
                  <td key={key}>{item[key] == null ? "—" : valeurElement(key, item[key])}</td>
                ))}
                {avecLien && (
                  <td>
                    {typeof item["url"] === "string" ? (
                      <a href={item["url"]} target="_blank" rel="noreferrer">
                        Ouvrir <ArrowUpRight size={11} />
                      </a>
                    ) : (
                      "—"
                    )}
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {items.length > ELEMENTS_AFFICHES && (
        <Button variant="link" className="anomaly-more" onClick={() => setTout((v) => !v)}>
          {tout ? "Réduire" : `Afficher les ${nombre(items.length)} éléments`}
        </Button>
      )}
    </>
  );
}
function FormulaireReference({
  anomaly,
  decision,
  onSave,
}: {
  anomaly: Anomaly;
  decision: Decision | undefined;
  onSave: (reference: NonNullable<Decision["reference"]>) => void;
}) {
  const observations = anomaly.observations ?? [];
  const initial = decision?.reference;
  const [choix, setChoix] = useState<string>(
    initial
      ? initial.observation == null
        ? "autre"
        : String(initial.observation)
      : observations.length
        ? ""
        : "autre",
  );
  const [autre, setAutre] = useState(initial?.observation == null ? (initial?.valeur ?? "") : "");
  const [note, setNote] = useState(initial?.note ?? "");
  const index = choix === "" || choix === "autre" ? null : Number(choix);
  const observation = index == null ? undefined : observations[index];
  const candidate = {
    observation: index,
    valeur: observation ? texteObservation(observation) : choix === "autre" ? autre : "",
    note,
    date: new Date().toISOString(),
  };
  const valide = referenceSchema.safeParse(candidate).success;
  return (
    <form
      className="anomaly-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (valide) onSave({ ...candidate, date: new Date().toISOString() });
      }}
    >
      <fieldset>
        <legend>Valeur de référence</legend>
        <RadioGroup value={choix} onValueChange={setChoix}>
          {observations.map((o, i) => (
            <div className="anomaly-choice" key={`${o.source.name}-${i}`}>
              <RadioGroupItem value={String(i)} id={`ref-${anomaly.id}-${i}`} />
              <Label htmlFor={`ref-${anomaly.id}-${i}`}>
                <strong>{texteObservation(o) || "Valeur non renseignée"}</strong>
                <span>{o.source.name}</span>
              </Label>
            </div>
          ))}
          <div className="anomaly-choice">
            <RadioGroupItem value="autre" id={`ref-${anomaly.id}-autre`} />
            <Label htmlFor={`ref-${anomaly.id}-autre`}>
              <strong>Autre valeur</strong>
              <span>Saisie par le label</span>
            </Label>
          </div>
        </RadioGroup>
        {choix === "autre" && (
          <Input
            aria-label="Autre valeur de référence"
            value={autre}
            onChange={(event) => setAutre(event.target.value)}
            placeholder="Valeur exacte à retenir"
          />
        )}
      </fieldset>
      <Label htmlFor={`note-${anomaly.id}`}>Note (obligatoire)</Label>
      <Textarea
        id={`note-${anomaly.id}`}
        value={note}
        onChange={(event) => setNote(event.target.value)}
        placeholder="Pourquoi cette valeur fait référence : contrat, dépôt, confirmation de l’artiste…"
      />
      {!valide && (
        <p className="anomaly-muted" id={`aide-ref-${anomaly.id}`}>
          Choisissez une valeur non vide et expliquez ce choix dans la note.
        </p>
      )}
      <Button
        type="submit"
        disabled={!valide}
        aria-describedby={valide ? undefined : `aide-ref-${anomaly.id}`}
      >
        Enregistrer la valeur de référence
      </Button>
    </form>
  );
}
function FormulaireIgnorer({ onSave }: { onSave: (motif: string) => void }) {
  const [motif, setMotif] = useState("");
  const valide = ignoreeSchema.safeParse({ motif, date: "" }).success;
  return (
    <form
      className="anomaly-form"
      onSubmit={(event) => {
        event.preventDefault();
        if (valide) onSave(motif.trim());
      }}
    >
      <Label htmlFor="motif-ignorer">Motif (obligatoire)</Label>
      <Textarea
        id="motif-ignorer"
        value={motif}
        onChange={(event) => setMotif(event.target.value)}
        placeholder="Par exemple : écart attendu, changement de label assumé…"
      />
      {!valide && (
        <p className="anomaly-muted" id="aide-ignorer">
          Le motif est obligatoire.
        </p>
      )}
      <Button
        type="submit"
        variant="outline"
        disabled={!valide}
        aria-describedby={valide ? undefined : "aide-ignorer"}
      >
        Ignorer l’anomalie
      </Button>
    </form>
  );
}
function FormulaireBrouillon({
  anomaly,
  decision,
  artiste,
  onSave,
  onDelete,
}: {
  anomaly: Anomaly;
  decision: Decision | undefined;
  artiste: string;
  onSave: (brouillon: Brouillon) => void;
  onDelete: () => void;
}) {
  const [brouillon, setBrouillon] = useState<Brouillon>(
    () => decision?.brouillon ?? brouillonInitial(anomaly, decision, new Date().toISOString()),
  );
  const demande = demandeCorrection(anomaly, brouillon);
  const etapes = etapesDestinataires(anomaly.target);
  const position = etapes.indexOf(brouillon.destinataire);
  const suivantes = position === -1 ? etapes : etapes.slice(position + 1);
  const referenceActuelle = decision?.reference?.valeur;
  // Saving first keeps the exported file and the local state "Demande préparée" in step.
  const enregistrerEtExporter = (format: "json" | "csv") => {
    const enregistre = { ...brouillon, date: new Date().toISOString() };
    exporterDemandes(
      artiste,
      [demandeCorrection(anomaly, enregistre)],
      format,
      `demande-${anomaly.id}`,
    );
    onSave(enregistre);
  };
  return (
    <form
      className="anomaly-form correction-draft"
      onSubmit={(event) => {
        event.preventDefault();
        onSave({ ...brouillon, date: new Date().toISOString() });
      }}
    >
      <LectureSeule compact />
      <Label htmlFor={`destinataire-${anomaly.id}`}>Destinataire</Label>
      <Select
        value={brouillon.destinataire}
        onValueChange={(value) =>
          setBrouillon((b) => ({ ...b, destinataire: value as Destinataire }))
        }
      >
        <SelectTrigger id={`destinataire-${anomaly.id}`}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {DESTINATAIRES.map((d) => (
            <SelectItem key={d} value={d}>
              {destinataires[d]}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {suivantes.length > 0 && (
        <p className="anomaly-muted">
          Ensuite : {suivantes.map((d) => destinataires[d]).join(", puis ")}
        </p>
      )}
      <div className="draft-current">
        <span className="draft-label">Valeurs actuelles</span>
        {demande.valeursActuelles.length ? (
          <ul>
            {demande.valeursActuelles.map((v, i) => (
              <li key={`${v.source}-${i}`}>
                <strong>{v.source}</strong> {v.valeur}
              </li>
            ))}
          </ul>
        ) : (
          <p className="anomaly-muted">Voir les éléments concernés.</p>
        )}
      </div>
      <Label htmlFor={`proposee-${anomaly.id}`}>Valeur proposée</Label>
      <Input
        id={`proposee-${anomaly.id}`}
        value={brouillon.valeurProposee}
        onChange={(event) => setBrouillon((b) => ({ ...b, valeurProposee: event.target.value }))}
        placeholder="Valeur à faire inscrire par le destinataire"
      />
      {referenceActuelle != null && referenceActuelle !== brouillon.valeurProposee && (
        <p className="anomaly-muted">
          La valeur de référence enregistrée est « {referenceActuelle} ».{" "}
          <Button
            type="button"
            variant="link"
            className="anomaly-more"
            onClick={() => setBrouillon((b) => ({ ...b, valeurProposee: referenceActuelle }))}
          >
            La reprendre
          </Button>
        </p>
      )}
      <Label htmlFor={`message-${anomaly.id}`}>Message</Label>
      <Textarea
        id={`message-${anomaly.id}`}
        className="draft-message"
        value={brouillon.message}
        onChange={(event) => setBrouillon((b) => ({ ...b, message: event.target.value }))}
      />
      <div className="draft-current">
        <span className="draft-label">Liens de preuve · {nombre(demande.preuves.length)}</span>
        <ul>
          {demande.preuves.slice(0, 5).map((lien) => (
            <li key={lien}>
              <a href={lien} target="_blank" rel="noreferrer">
                {lien.replace(/^https?:\/\//, "")}
              </a>
            </li>
          ))}
        </ul>
        {demande.preuves.length > 5 && (
          <p className="anomaly-muted">
            Et {nombre(demande.preuves.length - 5)} autres liens, inclus dans l’export.
          </p>
        )}
      </div>
      <p className="anomaly-muted">Daté du {dateFr(brouillon.date)}</p>
      <div className="draft-actions">
        <Button type="submit">Enregistrer le brouillon</Button>
        <Button type="button" variant="outline" onClick={() => enregistrerEtExporter("json")}>
          <Download /> Enregistrer et exporter en JSON
        </Button>
        <Button type="button" variant="outline" onClick={() => enregistrerEtExporter("csv")}>
          <Download /> Enregistrer et exporter en CSV
        </Button>
        {decision?.brouillon && (
          <Button type="button" variant="ghost" onClick={onDelete}>
            Supprimer le brouillon
          </Button>
        )}
      </div>
    </form>
  );
}
// Demo: shows a fixed answer until the worker stores real explanations.
function BlocExplication({ anomaly }: { anomaly: Anomaly }) {
  const [ouverte, setOuverte] = useState(false);
  const explication = explicationDemo(anomaly);
  if (!explication) return null;
  return (
    <section className="ai-explanation">
      <h3>Explication IA</h3>
      <p className="ai-explanation-warning">
        Exemple figé, sans lien avec cette anomalie : l’analyse réelle n’est pas encore branchée.
      </p>
      {ouverte ? (
        <div className="decision-summary">
          <Sparkles size={15} />
          <div lang="en">
            <strong>{explication.summary}</strong>
            <p>{explication.next_action}</p>
            <ul className="ai-evidence">
              {explication.evidence
                .filter((e) => explication.evidence_ids.includes(e.id))
                .map((e) => (
                  <li key={e.id}>
                    <span className="mono">{e.id}</span> {e.source} · {e.value}{" "}
                    <a href={e.url} target="_blank" rel="noreferrer">
                      Ouvrir <ArrowUpRight size={11} />
                    </a>
                  </li>
                ))}
            </ul>
            <span lang="fr">
              {explication.synthetic ? "Exemple synthétique · " : ""}
              Modèle prévu : {explication.model}
            </span>
          </div>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setOuverte(true)}>
          <Sparkles /> Voir un exemple
        </Button>
      )}
    </section>
  );
}
function DetailAnomalie({
  anomaly,
  decision,
  artiste,
  modifier,
  masquee,
  onClose,
}: {
  anomaly: Anomaly;
  decision: Decision | undefined;
  artiste: string;
  modifier: Modifier;
  masquee: boolean;
  onClose: () => void;
}) {
  const [action, setAction] = useState<"reference" | "ignorer" | "brouillon" | null>(null);
  const titre = useRef<HTMLHeadingElement>(null);
  // On narrow screens the list is hidden behind the detail, so focus follows the content.
  useEffect(() => {
    if (window.matchMedia("(max-width: 1050px)").matches) titre.current?.focus();
  }, []);
  const observations = anomaly.observations ?? [];
  const items = anomaly.items ?? [];
  const sauver = (change: (d: Decision) => Decision) => {
    modifier(anomaly.id, change);
    setAction(null);
  };
  return (
    <article className="anomaly-detail" aria-labelledby={`anomalie-${anomaly.id}`}>
      <Button variant="link" className="back-link anomaly-back" onClick={onClose}>
        <ArrowLeft /> Toutes les anomalies
      </Button>
      <div className="anomaly-detail-top">
        <span className="eyebrow">
          ANOMALIE {anomaly.id} · SOURCE :{" "}
          {(statutsSource[anomaly.status] ?? "Statut non renseigné").toUpperCase()}
        </span>
        <div className="anomaly-marks">
          <MarqueGravite severity={anomaly.severity} />
          <MarqueEtat decision={decision} />
        </div>
      </div>
      {masquee && (
        <p className="anomaly-muted">Cette anomalie est masquée par les filtres actuels.</p>
      )}
      <h2 id={`anomalie-${anomaly.id}`} ref={titre} tabIndex={-1}>
        {anomaly.label}
      </h2>
      <p className="anomaly-type">
        {libelleTypeAnomalie(anomaly.type)}
        {anomaly.field && ` · ${libelleChamp(anomaly.field)}`}
      </p>
      <p className="anomaly-description">
        {anomaly.description ?? "Aucune description renseignée."}
      </p>
      <section>
        <h3>Observations par source</h3>
        {observations.length ? (
          <div className="observation-grid">
            {observations.map((o, i) => (
              <div
                className={`observation ${decision?.reference?.observation === i ? "chosen" : ""}`}
                key={`${o.source.name}-${i}`}
              >
                <SourceBadge source={o.source} />
                <strong>{texteObservation(o) || "Valeur non renseignée"}</strong>
                {decision?.reference?.observation === i && (
                  <span className="observation-chosen">Valeur de référence</span>
                )}
              </div>
            ))}
          </div>
        ) : (
          <p className="anomaly-muted">
            Aucune observation globale : les écarts sont détaillés dans les éléments concernés.
          </p>
        )}
      </section>
      <BlocExplication anomaly={anomaly} />
      {items.length > 0 && (
        <section>
          <h3>
            Éléments concernés <span className="mono">{nombre(items.length)}</span>
          </h3>
          <TableElements items={items} />
        </section>
      )}
      <section className="anomaly-route">
        <div>
          <h3>Destinataire</h3>
          <Etapes target={anomaly.target} />
        </div>
        <div>
          <h3>Action suggérée</h3>
          <p>{anomaly.suggested_action ?? "Aucune action suggérée."}</p>
        </div>
      </section>
      <section className="anomaly-decision">
        <h3>Décision du label</h3>
        {decision?.reference && (
          <div className="decision-summary">
            <ListChecks size={15} />
            <div>
              <strong>Valeur de référence : {decision.reference.valeur}</strong>
              <p>{decision.reference.note}</p>
              <span>Enregistrée le {dateFr(decision.reference.date)}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => sauver(({ reference: _retiree, ...reste }) => reste)}
            >
              Retirer
            </Button>
          </div>
        )}
        {decision?.ignoree && (
          <div className="decision-summary">
            <EyeOff size={15} />
            <div>
              <strong>Anomalie ignorée</strong>
              <p>{decision.ignoree.motif}</p>
              <span>Le {dateFr(decision.ignoree.date)}</span>
            </div>
            <Button
              variant="ghost"
              size="sm"
              onClick={() => sauver(({ ignoree: _retiree, ...reste }) => reste)}
            >
              <RotateCcw /> Rétablir
            </Button>
          </div>
        )}
        <div className="decision-actions" role="group" aria-label="Actions sur l’anomalie">
          <Button
            variant={action === "reference" ? "default" : "outline"}
            onClick={() => setAction(action === "reference" ? null : "reference")}
          >
            <ListChecks /> Choisir la valeur de référence
          </Button>
          {!decision?.ignoree && (
            <Button
              variant={action === "ignorer" ? "default" : "outline"}
              onClick={() => setAction(action === "ignorer" ? null : "ignorer")}
            >
              <EyeOff /> Ignorer
            </Button>
          )}
          <Button
            variant={action === "brouillon" ? "default" : "outline"}
            onClick={() => setAction(action === "brouillon" ? null : "brouillon")}
          >
            <FilePen />{" "}
            {decision?.brouillon ? "Reprendre la demande" : "Préparer une demande de correction"}
          </Button>
        </div>
        {action === "reference" && (
          <FormulaireReference
            anomaly={anomaly}
            decision={decision}
            onSave={(reference) => sauver((d) => ({ ...d, reference }))}
          />
        )}
        {action === "ignorer" && (
          <FormulaireIgnorer
            onSave={(motif) =>
              sauver((d) => ({ ...d, ignoree: { motif, date: new Date().toISOString() } }))
            }
          />
        )}
        {action === "brouillon" && (
          <FormulaireBrouillon
            anomaly={anomaly}
            decision={decision}
            artiste={artiste}
            onSave={(brouillon) => sauver((d) => ({ ...d, brouillon }))}
            onDelete={() => sauver(({ brouillon: _retire, ...reste }) => reste)}
          />
        )}
      </section>
    </article>
  );
}
export function Anomalies({
  data,
  selected,
  decisions,
  modifier,
  persistant,
  onSelect,
}: {
  data: Referentiel;
  selected: string | undefined;
  decisions: Decisions;
  modifier: Modifier;
  persistant: boolean;
  onSelect: (id?: string) => void;
}) {
  const [filtres, setFiltres] = useState<FiltresAnomalies>(filtresParDefaut);
  const artiste = data.meta.artist_name ?? "artiste";
  const liste = filtrerAnomalies(data.anomalies, filtres, decisions);
  const anomaly = data.anomalies.find((a) => a.id === selected);
  // Closing the detail returns focus to its row once the list is visible again.
  const fermer = (id: string) => {
    onSelect();
    window.requestAnimationFrame(() =>
      document.querySelector<HTMLButtonElement>(`[data-anomalie="${id}"]`)?.focus(),
    );
  };
  const types = [...new Set(data.anomalies.flatMap((a) => (a.type ? [a.type] : [])))];
  const demandes = demandesPreparees(data.anomalies, decisions);
  return (
    <section
      className={`anomalies-section ${selected ? "with-detail" : ""}`}
      role="tabpanel"
      id="anomalies-panel"
      aria-label="Anomalies"
    >
      <div className="graph-heading">
        <div>
          <span className="eyebrow">REGISTRE DES ANOMALIES</span>
          <h2>À vérifier par le label</h2>
        </div>
        <span className="graph-count" aria-live="polite">
          {nombre(liste.length)} affichée{liste.length > 1 ? "s" : ""} sur{" "}
          {nombre(data.anomalies.length)}
        </span>
      </div>
      <LectureSeule />
      {!persistant && (
        <p className="read-only-notice warning" role="alert">
          <CircleAlert size={15} />
          <span>
            La mémoire locale de ce navigateur est indisponible : les décisions seront perdues au
            rechargement.
          </span>
        </p>
      )}
      <div className="graph-filters anomaly-filters">
        <fieldset>
          <legend>Gravité</legend>
          <div className="graph-type-filters">
            {GRAVITES.map((g) => (
              <label key={g}>
                <Checkbox
                  checked={filtres.gravites.includes(g)}
                  onCheckedChange={(checked) =>
                    setFiltres((f) => ({
                      ...f,
                      gravites: checked ? [...f.gravites, g] : f.gravites.filter((x) => x !== g),
                    }))
                  }
                  aria-label={gravites[g]}
                />
                <span className={`severity-dot severity-${g}`} />
                {gravites[g]}
              </label>
            ))}
          </div>
        </fieldset>
        <div className="anomaly-selects">
          <Select
            value={filtres.destinataire}
            onValueChange={(value) =>
              setFiltres((f) => ({ ...f, destinataire: value as FiltresAnomalies["destinataire"] }))
            }
          >
            <SelectTrigger aria-label="Filtrer par destinataire">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous les destinataires</SelectItem>
              {DESTINATAIRES.map((d) => (
                <SelectItem key={d} value={d}>
                  {destinataires[d]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filtres.type}
            onValueChange={(value) => setFiltres((f) => ({ ...f, type: value }))}
          >
            <SelectTrigger aria-label="Filtrer par type">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="tous">Tous les types</SelectItem>
              {types.map((t) => (
                <SelectItem key={t} value={t}>
                  {libelleTypeAnomalie(t)}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Select
            value={filtres.etat}
            onValueChange={(value) =>
              setFiltres((f) => ({ ...f, etat: value as FiltresAnomalies["etat"] }))
            }
          >
            <SelectTrigger aria-label="Filtrer par état local">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="non_ignorees">Non ignorées</SelectItem>
              <SelectItem value="tous">Tous les états</SelectItem>
              {ETATS_LOCAUX.map((e) => (
                <SelectItem key={e} value={e}>
                  {etatsLocaux[e]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <Button variant="ghost" size="sm" onClick={() => setFiltres(filtresParDefaut)}>
            <RotateCcw /> Réinitialiser
          </Button>
        </div>
      </div>
      <div className="anomalies-body">
        <ul className="anomaly-list" aria-label="Anomalies triées par gravité">
          {liste.map((a) => (
            <li key={a.id}>
              <button
                type="button"
                className={`anomaly-row ${a.id === selected ? "selected" : ""}`}
                aria-current={a.id === selected ? "true" : undefined}
                data-anomalie={a.id}
                onClick={() => onSelect(a.id)}
              >
                <span className={`severity-dot severity-${a.severity ?? "inconnue"}`} />
                <span className="anomaly-row-body">
                  <span className="anomaly-row-top">
                    <span className="mono">{a.id}</span>
                    <MarqueGravite severity={a.severity} />
                    <MarqueEtat decision={decisions[a.id]} />
                  </span>
                  <strong>{a.label}</strong>
                  <span className="anomaly-row-meta">
                    {libelleTypeAnomalie(a.type)} ·{" "}
                    {destinataires[etapesDestinataires(a.target)[0] ?? ""] ??
                      "Destinataire non renseigné"}
                  </span>
                </span>
                <ArrowRight className="result-arrow" size={16} />
              </button>
            </li>
          ))}
          {liste.length === 0 && (
            <li className="anomaly-muted anomaly-empty">Aucune anomalie pour ces filtres.</li>
          )}
        </ul>
        {selected && !anomaly && (
          <div className="anomaly-detail" role="status">
            <p>Anomalie {selected} introuvable dans ce référentiel.</p>
            <Button variant="link" className="anomaly-more" onClick={() => onSelect()}>
              <ArrowLeft /> Toutes les anomalies
            </Button>
          </div>
        )}
        {anomaly && (
          <DetailAnomalie
            key={anomaly.id}
            anomaly={anomaly}
            decision={decisions[anomaly.id]}
            artiste={artiste}
            modifier={modifier}
            masquee={!liste.includes(anomaly)}
            onClose={() => fermer(anomaly.id)}
          />
        )}
      </div>
      <div className="drafts-export">
        <div>
          <strong>
            {nombre(demandes.length)} demande{demandes.length > 1 ? "s" : ""} de correction préparée
            {demandes.length > 1 ? "s" : ""}
          </strong>
          <span>Export avec en-têtes en français, à transmettre vous-même au destinataire.</span>
        </div>
        <div className="draft-actions">
          <Button
            variant="outline"
            disabled={!demandes.length}
            onClick={() => exporterDemandes(artiste, demandes, "json")}
          >
            <Download /> JSON
          </Button>
          <Button
            variant="outline"
            disabled={!demandes.length}
            onClick={() => exporterDemandes(artiste, demandes, "csv")}
          >
            <Download /> CSV
          </Button>
        </div>
      </div>
    </section>
  );
}
