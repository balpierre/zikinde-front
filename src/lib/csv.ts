/**
 * Petit parseur CSV pour les imports manuels : séparateur `,` ou `;` (détecté sur l'en-tête),
 * champs entre guillemets (avec `""` échappé et retours à la ligne), BOM UTF-8, fins de ligne CRLF.
 * La première ligne est l'en-tête.
 */
export interface CsvResultat {
  colonnes: string[];
  lignes: Record<string, string>[];
}

function detecterSeparateur(texte: string): "," | ";" {
  let virgules = 0;
  let pointsVirgules = 0;
  let entreGuillemets = false;
  for (const c of texte) {
    if (c === '"') entreGuillemets = !entreGuillemets;
    else if (!entreGuillemets && (c === "\n" || c === "\r")) break;
    else if (!entreGuillemets && c === ",") virgules++;
    else if (!entreGuillemets && c === ";") pointsVirgules++;
  }
  return pointsVirgules > virgules ? ";" : ",";
}

function decouper(texte: string, separateur: string): string[][] {
  const lignes: string[][] = [];
  let ligne: string[] = [];
  let champ = "";
  let entreGuillemets = false;
  for (let i = 0; i < texte.length; i++) {
    const c = texte[i]!;
    if (entreGuillemets) {
      if (c === '"') {
        if (texte[i + 1] === '"') {
          champ += '"';
          i++;
        } else entreGuillemets = false;
      } else champ += c;
    } else if (c === '"') entreGuillemets = true;
    else if (c === separateur) {
      ligne.push(champ);
      champ = "";
    } else if (c === "\n" || c === "\r") {
      if (c === "\r" && texte[i + 1] === "\n") i++;
      ligne.push(champ);
      lignes.push(ligne);
      ligne = [];
      champ = "";
    } else champ += c;
  }
  if (champ !== "" || ligne.length) {
    ligne.push(champ);
    lignes.push(ligne);
  }
  // Les lignes entièrement vides ne sont pas des données.
  return lignes.filter((l) => l.some((v) => v.trim() !== ""));
}

export function parseCsv(texte: string): CsvResultat {
  const propre = texte.replace(/^\uFEFF/, "");
  const [entete, ...donnees] = decouper(propre, detecterSeparateur(propre));
  if (!entete) return { colonnes: [], lignes: [] };
  const colonnes = entete.map((c, i) => c.trim() || `colonne_${i + 1}`);
  const lignes = donnees.map((valeurs) => {
    const ligne: Record<string, string> = {};
    colonnes.forEach((colonne, i) => {
      ligne[colonne] = (valeurs[i] ?? "").trim();
    });
    return ligne;
  });
  return { colonnes, lignes };
}
