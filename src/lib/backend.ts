/**
 * Accès au backend Music Data Hub (Supabase) — contrat : zikinde/docs/FRONTEND.md.
 * Lecture : vues v_* et tables autorisées par la RLS. Écriture : uniquement via les RPC.
 */
import { queryOptions } from "@tanstack/react-query";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./supabase";

export type StepStatus =
  "running" | "done" | "error" | "not_configured" | "rate_limited" | "no_connector";

export interface StepInfo {
  status: StepStatus;
  source_id?: string | string[];
  stats?: Record<string, number>;
  stored?: boolean;
  error?: string;
  retry_after_s?: number;
}

export type JobStatus = "queued" | "running" | "done" | "error";

export interface Job {
  id: string;
  type: "discover" | "collect" | "reconcile" | "audit";
  status: JobStatus;
  progress: Record<string, StepInfo>;
  result: Record<string, unknown> | null;
  error: string | null;
  created_at: string;
  finished_at: string | null;
}

export interface Candidate {
  source_id: string;
  name: string;
  score: number;
  method: string;
  evidence: {
    type?: string | null;
    area?: string | null;
    /** Pays (ISO 3166-1 alpha-2 ou libellé) : champs ajoutés au back, optionnels avant déploiement. */
    country?: string | null;
    /** Début d’activité tel que la source le donne (« 1998 », « 1998-05-04 »). */
    life_span?: { begin?: string | null };
    disambiguation?: string | null;
    isnis?: string[];
    aliases?: string[];
  };
}

export type ArtistStatus = "pending" | "collecting" | "ready" | "error";

export interface OrgArtist {
  id: string;
  org_id: string;
  name: string;
  mbid: string | null;
  status: ArtistStatus;
  known_ids: Record<string, string[]>;
  created_at: string;
  last_collected_at: string | null;
  last_job_id: string | null;
  last_job_status: JobStatus | null;
  last_job_progress: Record<string, StepInfo> | null;
  last_job_error: string | null;
}

export interface Identifier {
  scheme: string;
  value: string;
}

export type LinkStatus = "validated" | "proposed" | "rejected";

/** Compte d’un artiste dans une source (`v_artist_sources`). Les champs `reason` et `score` arrivent avec le back. */
export interface SourceAccount {
  link_id: number;
  source: string;
  source_id: string;
  name: string;
  url: string | null;
  method: string;
  link_status: LinkStatus;
  /** Raison lisible de la mise de côté (comptes `proposed`). */
  reason?: string | null;
  /** Cohérence avec le compte choisi, 0..1 ; null si non calculée. */
  score?: number | null;
  attributes: Record<string, unknown>;
  identifiers: Identifier[];
}

export type CatalogType = "recording" | "release" | "release_group" | "work";

export interface CatalogItem {
  source_entity_id: number;
  source: string;
  entity_type: CatalogType;
  source_id: string;
  name: string;
  url: string | null;
  attributes: Record<string, unknown>;
  identifiers: Identifier[];
  relation_types: string[];
}

export interface Anomaly {
  id: number;
  kind: string;
  severity: "info" | "warning" | "error";
  details: Record<string, unknown>;
  status: "open" | "resolved" | "ignored";
  created_at: string;
}

function unwrap<T>({ data, error }: { data: T | null; error: { message: string } | null }): T {
  if (error) throw new Error(error.message);
  return data as T;
}

// ------------------------------------------------------------------ authentification

function check(error: { message: string } | null): void {
  if (error) throw new Error(error.message);
}

export async function getSession(): Promise<Session | null> {
  const { data, error } = await supabase().auth.getSession();
  check(error);
  return data.session;
}

export async function signIn(email: string, password: string): Promise<void> {
  const { error } = await supabase().auth.signInWithPassword({ email, password });
  check(error);
}

/** Renvoie true si la session est ouverte, false si un e-mail de confirmation a été envoyé. */
export async function signUp(email: string, password: string): Promise<boolean> {
  const { data, error } = await supabase().auth.signUp({
    email,
    password,
    options: { emailRedirectTo: `${window.location.origin}/extractions` },
  });
  check(error);
  return Boolean(data.session);
}

export async function signOut(): Promise<void> {
  const { error } = await supabase().auth.signOut();
  check(error);
}

// ------------------------------------------------------------------ label

export interface Organization {
  id: string;
  name: string;
}

/** Charge les labels accessibles et crée le premier à l’arrivée d’un nouvel utilisateur. */
async function ensureOrganizations(): Promise<Organization[]> {
  const organizations = unwrap(
    await supabase().from("organizations").select("id, name").order("created_at").order("id"),
  ) as Organization[];
  if (organizations.length) return organizations;
  const session = await getSession();
  const name = session?.user.email?.split("@")[0] ?? "Mon label";
  const id = unwrap(await supabase().rpc("create_organization", { p_name: name })) as string;
  return [{ id, name }];
}

export function organizationsQuery(userId: string | undefined) {
  return queryOptions({
    queryKey: ["organisations", userId],
    queryFn: ensureOrganizations,
    enabled: Boolean(userId),
  });
}

export function selectOrganization(
  organizations: Organization[] | undefined,
  preferredId: string | undefined,
): Organization | undefined {
  return organizations?.find(({ id }) => id === preferredId) ?? organizations?.[0];
}

export function organizationSearch(search: Record<string, unknown>): { label?: string } {
  return typeof search["label"] === "string" ? { label: search["label"] } : {};
}

// ------------------------------------------------------------------ jobs

export async function getJob(jobId: string): Promise<Job> {
  return unwrap(
    await supabase()
      .from("jobs")
      .select("id, type, status, progress, result, error, created_at, finished_at")
      .eq("id", jobId)
      .single(),
  ) as Job;
}

/**
 * Suit un job en direct (Realtime) avec une relecture périodique en secours.
 * Renvoie une fonction d'arrêt.
 */
export function watchJob(jobId: string, onUpdate: (job: Job) => void): () => void {
  let stopped = false;
  const refresh = async () => {
    if (stopped) return;
    try {
      const job = await getJob(jobId);
      if (!stopped) onUpdate(job);
      if (job.status === "done" || job.status === "error") stop();
    } catch {
      /* relecture suivante */
    }
  };
  const channel = supabase()
    .channel(`job-${jobId}`)
    .on(
      "postgres_changes",
      { event: "UPDATE", schema: "public", table: "jobs", filter: `id=eq.${jobId}` },
      () => void refresh(),
    )
    .subscribe();
  const timer = window.setInterval(() => void refresh(), 2500);
  void refresh();
  function stop() {
    if (stopped) return;
    stopped = true;
    window.clearInterval(timer);
    void supabase().removeChannel(channel);
  }
  return stop;
}

export function waitJob(jobId: string, onUpdate?: (job: Job) => void): Promise<Job> {
  return new Promise((resolve) => {
    const stop = watchJob(jobId, (job) => {
      onUpdate?.(job);
      if (job.status === "done" || job.status === "error") {
        stop();
        resolve(job);
      }
    });
  });
}

// ------------------------------------------------------------------ parcours

export async function requestDiscover(orgId: string, name: string): Promise<string> {
  return unwrap(await supabase().rpc("request_discover", { p_org: orgId, p_name: name })) as string;
}

export async function trackArtist(orgId: string, name: string, mbid: string): Promise<string> {
  return unwrap(
    await supabase().rpc("track_artist", { p_org: orgId, p_name: name, p_mbid: mbid }),
  ) as string;
}

export async function refreshArtist(artistId: string): Promise<string> {
  return unwrap(await supabase().rpc("refresh_artist", { p_artist: artistId })) as string;
}

/** Relance la réconciliation de l’artiste (référentiel recalculé) ; renvoie l’uuid du job. */
export async function requestReconcile(artistId: string): Promise<string> {
  return unwrap(await supabase().rpc("request_reconcile", { p_artist: artistId })) as string;
}

/** Retire un compte source de l’artiste (« ce n’est pas mon artiste ») ; renvoie l’uuid du job `reconcile`. */
export async function rejectAccount(linkId: number): Promise<string> {
  return unwrap(await supabase().rpc("reject_account", { p_link: linkId })) as string;
}

/** Réintègre un compte mis de côté et relance une collecte complète ; renvoie l’uuid du job `collect`. */
export async function acceptAccount(linkId: number): Promise<string> {
  return unwrap(await supabase().rpc("accept_account", { p_link: linkId })) as string;
}

/** Valide, refuse ou remet en attente un rapprochement (compte ou titre). */
export async function decideLink(linkId: number, status: LinkStatus): Promise<void> {
  const { error } = await supabase().rpc("decide_link", { p_link: linkId, p_status: status });
  check(error);
}

// ------------------------------------------------------------------ lecture

export async function listArtists(orgId: string): Promise<OrgArtist[]> {
  return unwrap(
    await supabase()
      .from("v_org_artists")
      .select("*")
      .eq("org_id", orgId)
      .order("created_at", { ascending: false }),
  ) as OrgArtist[];
}

export async function getArtist(artistId: string): Promise<OrgArtist | null> {
  return unwrap(
    await supabase().from("v_org_artists").select("*").eq("id", artistId).maybeSingle(),
  ) as OrgArtist | null;
}

/**
 * Comptes validés et mis de côté. Sélection `*` volontaire : `reason` et `score` n’existent qu’après la
 * migration `20261121000500_homonymes` ; une liste explicite ferait échouer la lecture avant déploiement.
 */
export async function getSourceAccounts(artistId: string): Promise<SourceAccount[]> {
  return unwrap(
    await supabase().from("v_artist_sources").select("*").eq("org_artist_id", artistId),
  ) as SourceAccount[];
}

/**
 * Identifiant de lien de chaque titre du catalogue, indexé par `source|source_id`.
 * Le catalogue (`v_artist_catalog`) n’expose pas `link_id` ; on le lit dans `v_artist_entities`.
 */
export async function getTitleLinks(artistId: string): Promise<Record<string, number>> {
  const rows = unwrap(
    await supabase().from("v_artist_entities").select("sources").eq("org_artist_id", artistId),
  ) as { sources: { source: string; source_id: string; link_id: number }[] }[];
  const links: Record<string, number> = {};
  for (const row of rows) {
    for (const s of row.sources) links[`${s.source}|${s.source_id}`] = s.link_id;
  }
  return links;
}

export async function countCatalog(artistId: string): Promise<Record<CatalogType, number>> {
  const types: CatalogType[] = ["recording", "release", "release_group", "work"];
  const counts = await Promise.all(
    types.map(async (type) => {
      const { count, error } = await supabase()
        .from("v_artist_catalog")
        .select("source_entity_id", { count: "exact", head: true })
        .eq("org_artist_id", artistId)
        .eq("entity_type", type);
      if (error) throw new Error(error.message);
      return [type, count ?? 0] as const;
    }),
  );
  return Object.fromEntries(counts) as Record<CatalogType, number>;
}

export async function getCatalog(
  artistId: string,
  type: CatalogType,
  limit = 1000,
): Promise<CatalogItem[]> {
  return unwrap(
    await supabase()
      .from("v_artist_catalog")
      .select(
        "source_entity_id, source, entity_type, source_id, name, url, attributes, identifiers, relation_types",
      )
      .eq("org_artist_id", artistId)
      .eq("entity_type", type)
      .order("name")
      .limit(limit),
  ) as CatalogItem[];
}

export async function getAnomalies(artistId: string): Promise<Anomaly[]> {
  return unwrap(
    await supabase()
      .from("anomalies")
      .select("id, kind, severity, details, status, created_at")
      .eq("org_artist_id", artistId)
      .order("created_at", { ascending: false }),
  ) as Anomaly[];
}

// ------------------------------------------------------------------ imports manuels

/** Nombre maximal de lignes acceptées par `create_manual_import`. */
export const MAX_LIGNES_IMPORT = 20_000;

export interface ManualImport {
  id: string;
  name: string;
  filename: string | null;
  columns: string[] | null;
  row_count: number;
  created_at: string;
}

export async function listManualImports(artistId: string): Promise<ManualImport[]> {
  return unwrap(
    await supabase()
      .from("manual_imports")
      .select("id, name, filename, columns, row_count, created_at")
      .eq("org_artist_id", artistId)
      .order("created_at", { ascending: false }),
  ) as ManualImport[];
}

/** Crée un import manuel et met en file un job `reconcile` ; renvoie l'uuid de l'import. */
export async function createManualImport(
  artistId: string,
  name: string,
  filename: string,
  rows: Record<string, string>[],
): Promise<string> {
  if (rows.length > MAX_LIGNES_IMPORT)
    throw new Error(`Un import est limité à ${MAX_LIGNES_IMPORT} lignes.`);
  return unwrap(
    await supabase().rpc("create_manual_import", {
      p_artist: artistId,
      p_name: name,
      p_filename: filename,
      p_rows: rows,
    }),
  ) as string;
}

export async function deleteManualImport(importId: string): Promise<void> {
  const { error } = await supabase().rpc("delete_manual_import", { p_import: importId });
  check(error);
}
