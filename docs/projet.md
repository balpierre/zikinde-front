# Zikindé — référence projet

Point de référence pour tout agent ou contributeur. Lire avant de proposer une
fonctionnalité, un écran ou un changement de données. Les règles techniques
détaillées restent dans `AGENTS.md`.

## L'idée

Zikindé est un **référentiel vérifiable de catalogue musical pour les labels
indépendants**. Pour un artiste, il croise plusieurs sources publiques, montre
ce que chacune affirme, où elles concordent ou divergent, et signale les
anomalies qui coûtent des droits (ISRC manquant, œuvre sans ISWC, sortie
absente, label divergent…).

Promesse affichée : « La musique, à la source », « La trace de chaque titre ».

Trois principes structurent tout le produit :

1. **Œuvre ≠ Enregistrement ≠ Sortie.** Œuvre = composition et paroles (ISWC,
   droits d'auteur). Enregistrement = interprétation fixée (ISRC, droits
   voisins). Sortie = produit commercialisé (UPC/EAN, distribution). Ne jamais
   fusionner ces trois niveaux, ni dans les données ni dans l'interface.
2. **Provenance d'abord.** Chaque valeur affichée porte sa source, son URL et
   sa date de collecte. Une donnée absente s'affiche comme absente (« — »,
   état « non renseigné »), jamais inventée ni déduite silencieusement.
3. **Déclaré ≠ inféré.** Une relation inférée (ex. œuvre→enregistrement par le
   titre) est marquée comme telle. Les rapprochements d'anomalies se font sur
   des identifiants exacts (ISRC), pas sur des titres.

Utilisateur cible : un label indépendant ou un ayant droit qui veut vérifier
et corriger le catalogue d'un artiste. Cas d'étude actuel : **Senbeï**
(Banzaï Lab).

## Ce qui existe

Deux repos dans `~/zikinde/` :

- **`zikinde`** (Python, stdlib) : connecteurs de collecte Wikidata,
  MusicBrainz, Deezer, Discogs. Wikidata sert de pivot d'identité (trouvé via
  le MBID). Chaque objet porte un bloc `provenance`.
- **`zikinde-front`** (ce repo, Lovable) : l'application Zikindé,
  TanStack Start + React Query + Tailwind 4 + shadcn + Cytoscape.

Le front lit un fichier figé, `public/data/referentiel_senbei.json`
(444 nœuds, 887 arêtes, 1 460 affirmations, 13 anomalies, matrice de 9 champs),
uniquement via `src/lib/referentiel.ts`.

Parcours actuel :

| Route | Rôle |
| --- | --- |
| `/` | Recherche d'artiste. Seul Senbeï est reconnu ; sinon « pas encore dans le référentiel » et bouton « Lancer la collecte » désactivé. |
| `/collecte/senbei` | Animation de lecture des quatre sources, puis synthèse (œuvres, enregistrements, sorties, anomalies). |
| `/artiste/senbei` | Fiche artiste. Vue d'ensemble : matrice de concordance, présence numérique, chiffres clés et couverture ISRC/ISWC. |
| `?vue=genealogie` | Généalogie en quatre colonnes œuvre → enregistrement → sortie → plateforme, avec alertes ISRC reliées aux anomalies. |
| `?vue=graphe` | Graphe Cytoscape filtrable, panneau de propriétés, affirmations divergentes et relations. |
| `?vue=anomalies` | Registre des anomalies trié par gravité, filtres, vue détaillée (`&anomalie=A05`), décisions locales (valeur de référence, ignorer, brouillon de demande de correction) et exports JSON/CSV. |

La roadmap de `roadmap.md` est entièrement cochée : le prototype Senbeï est
complet.

## Le design actuel

Direction : **éditorial sombre, sobre, « fiche de catalogue »**. Interface
entièrement en français.

- Fond quasi noir légèrement vert (`oklch(0.155 0.004 120)`), texte crème,
  un seul accent **vert-jaune acide** (`--primary`, `oklch(0.875 0.175 123)`).
  Pas de mode clair.
- Typographies : DM Sans (texte), IBM Plex Mono (codes, surtitres, métadonnées
  en capitales), Libre Caslon Display (un mot en italique serif dans les
  titres, ex. « un *artiste.* »).
- Motifs récurrents : surtitres en capitales espacées (`.eyebrow`), point
  final accentué après les noms (`.heading-dot`), numérotation mono (`01`,
  `LP—001`), badges de source, bandeau des trois concepts avec `≠`.
- Couleurs sémantiques centralisées dans `src/styles.css` : statuts de
  matrice (`--status-*`), types de nœuds du graphe (`--graph-*`), niveaux
  œuvre / enregistrement / sortie (`--work`, `--recording`, `--release`).
  Ne pas coder de couleur en dur dans un composant.
- Rayons faibles (4–8 px), bordures fines, peu d'ombres. Animations courtes,
  désactivées sous `prefers-reduced-motion`.
- Responsive vérifié sur téléphone.

## Où on va

Le code prépare explicitement les étapes suivantes. Pistes déduites du code,
**à confirmer** avant d'en faire un objectif :

1. **Sortir du cas unique Senbeï** : routes paramétrées par artiste, recherche
   réelle dans le référentiel.
2. **Brancher la collecte** : relier « Lancer la collecte » aux connecteurs de
   `zikinde`, exposés derrière une API ; `referentiel.ts` est conçu pour
   remplacer la lecture du JSON par cet appel sans toucher aux pages.
3. **Décisions partagées** : les décisions sur les anomalies vivent dans le
   `localStorage` du navigateur ; les passer sur une API quand elle existera.
4. **Choix élément par élément** dans le tableau d'une anomalie, et export zip.

## Règles pour travailler avec un agent

- Respecter les trois principes ci-dessus avant toute considération visuelle.
- Rester dans le design existant : réutiliser les classes et tokens de
  `src/styles.css` et les composants de `src/components/label-pulse/shared.tsx`.
- Libellés et formats français uniquement via `src/lib/libelles.ts`.
- Ne pas modifier `public/data/referentiel_senbei.json` : normaliser dans
  `referentiel.ts`.
- Branche `main` synchronisée avec Lovable : la garder fonctionnelle, ne pas
  réécrire l'historique poussé.
- Zikindé ne modifie jamais une plateforme tierce : toute action sur une
  anomalie reste locale ou produit un brouillon que le label transmet lui-même.
  L'état local d'une anomalie ne remplace jamais son statut côté sources.
- Vérifier avec `bun run test` et `bun run lint`.
