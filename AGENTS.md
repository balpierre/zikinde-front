<!-- LOVABLE:BEGIN -->

> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.

## What Lovable manages

Rules outside this block are the project's own. Change the pieces below in
Lovable, not by hand. With the [Lovable MCP](https://mcp.lovable.dev)
connected, `send_message` asks Lovable to do it; otherwise ask the user to
use the editor.

- **Database.** Do not add or edit `supabase/migrations/` or `drizzle/`.
  Ask Lovable to change the schema.
- **Generated files.** Do not edit a file whose header says it is automatically
  generated.
- **AI gateway.** Keep model calls on Lovable's gateway, and keep
  `LOVABLE_API_KEY` out of browser code.
- **Connectors.** Lovable provides native connectors. `list_connectors` shows
  which are enabled; `add_connector` only returns the dashboard link. When a
  connector is enabled, calls go through the connector gateway and need
  `LOVABLE_API_KEY`. When Lovable does not provide one, users can bring their
  own key and store it in Secrets.
- **Secrets.** Lovable manages them. Do not put secret values in the repo.

<!-- LOVABLE:END -->

## Project reference

Read `docs/projet.md` first: product idea, current scope, design direction and
next steps.

## Application architecture

- Keep the template’s TanStack Router for navigation; it preserves the supported SSR and file-route integration.
- Read catalog data only through `src/lib/referentiel.ts`, with typed validation and Query caching, so pages can later use an API without reading JSON directly.
- Keep the original public catalog JSON unchanged; validate and normalize its source IDs, claims, graph endpoints and nested genealogies only in the referential module so provenance is preserved. SSR imports the same public JSON dynamically while the browser fetches its public URL; both normalize identically to avoid hydration discrepancies. Missing or invalid responses show explicit unavailable states instead of invented facts.
- Centralize technical-value translations and French formatting in `src/lib/libelles.ts` so pages never expose raw technical identifiers as labels.

- Build genealogy projections in a pure browser-safe module from normalized referential data; only explicit graph edges connect releases and platforms, and anomaly matching uses exact ISRC fields rather than titles.
- Store the artist view, work selection and opened anomaly in optional URL search parameters so links, reload and browser history preserve genealogy context.

- Load Cytoscape dynamically after mount and destroy each instance on unmount; keep graph selection and claim-divergence rules in a pure data module for SSR safety and tests.
- Source graph colors from global semantic tokens, with deterministic centered preset positions; node filters include only the top 20 ranked recordings and explicit artist proximity edges.

## Backend (extractions)

- Le backend est le projet Supabase du dépôt `zikinde` (contrat : `zikinde/docs/FRONTEND.md`). Ce front ne gère
  ni le schéma ni les migrations : ne pas activer Lovable Cloud ni créer de projet Supabase, ne rien ajouter dans
  `supabase/migrations/` ici.
- Tout accès au backend passe par `src/lib/backend.ts` (lecture des vues `v_*`, écriture uniquement via les RPC).
  Le client est créé dans `src/lib/supabase.ts` à partir de `VITE_SUPABASE_URL` et `VITE_SUPABASE_PUBLISHABLE_KEY`
  (valeurs publiques ; jamais la clé `service_role`).
- Les pages qui utilisent la session (`/connexion`, `/extractions`, `/extractions/$artistId`) sont en `ssr: false` :
  la session vit dans le navigateur.
- Parcours : recherche → job `discover` → l'utilisateur choisit le bon compte (jamais de présélection) →
  `track_artist` → progression en direct du job `collect` → résultats.
- Les pages `/collecte/senbei` et `/artiste/senbei` restent la démonstration statique du référentiel.
- Déploiement : `scripts/deploy-cloudflare.sh` (Cloudflare Workers, domaine `zikinde.claves-technologies.fr`,
  prérequis `npx wrangler@4 login`). Pas de Lovable pour la mise en ligne.
