import { useState, type FormEvent } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { setLabelProfile, type LabelProfile } from "@/lib/backend";
import { listeSaisie, normaliserCodeIsrc, normaliserPrefixeUpc } from "@/lib/label";

/** Formulaire « Mon label ». Une valeur par ligne ; à monter avec `key={orgId}` pour repartir du profil lu. */
export function ProfilLabelForm({ orgId, profil }: { orgId: string; profil: LabelProfile | null }) {
  const queryClient = useQueryClient();
  const [noms, setNoms] = useState((profil?.names ?? []).join("\n"));
  const [prefixes, setPrefixes] = useState((profil?.upc_prefixes ?? []).join("\n"));
  const [isrc, setIsrc] = useState((profil?.isrc_registrants ?? []).join("\n"));
  const [enCours, setEnCours] = useState(false);
  const [message, setMessage] = useState<string | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);

  async function enregistrer(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setEnCours(true);
    setMessage(null);
    setErreur(null);
    try {
      await setLabelProfile(orgId, {
        names: listeSaisie(noms),
        upc_prefixes: listeSaisie(prefixes, normaliserPrefixeUpc),
        isrc_registrants: listeSaisie(isrc, normaliserCodeIsrc),
      });
      setMessage(
        "Profil enregistré. Recalcul en cours : le catalogue et les anomalies se mettront à jour.",
      );
      await queryClient.invalidateQueries({ queryKey: ["label-profil", orgId] });
    } catch (e) {
      setErreur(e instanceof Error ? e.message : String(e));
    } finally {
      setEnCours(false);
    }
  }

  return (
    <form className="mt-6 grid max-w-2xl gap-6" onSubmit={(e) => void enregistrer(e)}>
      <div className="grid gap-2">
        <Label htmlFor="label-noms">Noms du label</Label>
        <p className="text-sm text-muted-foreground">
          Un nom par ligne, variantes comprises (ex. Banzaï Lab, Banzai Lab Records).
        </p>
        <Textarea id="label-noms" rows={3} value={noms} onChange={(e) => setNoms(e.target.value)} />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="label-upc">Préfixes UPC (code-barres)</Label>
        <p className="text-sm text-muted-foreground">
          Un préfixe par ligne, chiffres seulement (ex. 3663729).
        </p>
        <Textarea
          id="label-upc"
          rows={3}
          value={prefixes}
          onChange={(e) => setPrefixes(e.target.value)}
        />
      </div>
      <div className="grid gap-2">
        <Label htmlFor="label-isrc">Codes ISRC du producteur</Label>
        <p className="text-sm text-muted-foreground">
          Un code par ligne, pays et producteur sur 5 caractères (ex. FRPHC).
        </p>
        <Textarea id="label-isrc" rows={3} value={isrc} onChange={(e) => setIsrc(e.target.value)} />
      </div>
      <div className="flex flex-wrap items-center gap-3">
        <Button type="submit" disabled={enCours}>
          {enCours ? "Enregistrement…" : "Enregistrer"}
        </Button>
        {message && (
          <p className="text-sm text-muted-foreground" role="status">
            {message}
          </p>
        )}
        {erreur && (
          <p className="text-sm text-destructive" role="alert">
            {erreur}
          </p>
        )}
      </div>
    </form>
  );
}
