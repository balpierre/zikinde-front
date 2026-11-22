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

export interface SourceAccount {
  source: string;
  source_id: string;
  name: string;
  url: string | null;
  method: string;
  link_status: string;
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

export interface AnomalyExplanation {
  anomaly_id: number;
  job_id: string;
  status: JobStatus;
  explanation: {
    summary: string;
    next_action: string;
    evidence: {
      id: string;
      source: string;
      source_id: string;
      url: string;
      fetched_at: string;
      value: string;
    }[];
  } | null;
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

/**
 * Charge les labels accessibles et crée le premier à l’arrivée d’un nouvel utilisateur.
 * Les invitations sont acceptées d’abord : un invité rejoint le label qui l’a invité au lieu d’en créer un vide.
 */
async function ensureOrganizations(): Promise<Organization[]> {
  check((await supabase().rpc("accept_invitations")).error);
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

// ------------------------------------------------------------------ membres du label

export type MemberRole = "owner" | "member";

export interface Member {
  user_id: string;
  email: string | null;
  role: MemberRole;
  joined_at: string;
}

export interface Invitation {
  id: string;
  email: string;
  created_at: string;
}

export function isOwner(members: Member[] | undefined, userId: string | undefined): boolean {
  return Boolean(userId && members?.some((m) => m.user_id === userId && m.role === "owner"));
}

export async function listMembers(orgId: string): Promise<Member[]> {
  return unwrap(await supabase().rpc("list_org_members", { p_org: orgId })) as Member[];
}

export async function listInvitations(orgId: string): Promise<Invitation[]> {
  return unwrap(
    await supabase()
      .from("invitations")
      .select("id, email, created_at")
      .eq("org_id", orgId)
      .order("created_at"),
  ) as Invitation[];
}

/** Invite une adresse (réservé à l’owner) ; le compte qui la porte rejoint le label à sa connexion. */
export async function inviteMember(orgId: string, email: string): Promise<string> {
  return unwrap(
    await supabase().rpc("invite_member", { p_org: orgId, p_email: email.trim() }),
  ) as string;
}

export async function revokeInvitation(invitationId: string): Promise<void> {
  check((await supabase().rpc("revoke_invitation", { p_invitation: invitationId })).error);
}

export async function removeMember(orgId: string, userId: string): Promise<void> {
  check((await supabase().rpc("remove_member", { p_org: orgId, p_user: userId })).error);
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

export async function getSourceAccounts(artistId: string): Promise<SourceAccount[]> {
  return unwrap(
    await supabase()
      .from("v_artist_sources")
      .select("source, source_id, name, url, method, link_status, attributes, identifiers")
      .eq("org_artist_id", artistId),
  ) as SourceAccount[];
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

export function anomalyExplanationsOptions(artistId: string) {
  return queryOptions({
    queryKey: ["resultats", artistId, "anomaly-explanations"],
    queryFn: async () =>
      unwrap(
        await supabase()
          .from("v_anomaly_explanations")
          .select("anomaly_id, job_id, status, explanation")
          .eq("org_artist_id", artistId),
      ) as AnomalyExplanation[],
  });
}

export async function requestAnomalyExplanation(anomalyId: number): Promise<string> {
  return unwrap(
    await supabase().rpc("request_anomaly_explanation", { p_anomaly: anomalyId }),
  ) as string;
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
