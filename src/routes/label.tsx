import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { Shell, metadata } from "@/components/label-pulse/shared";
import { RequireAuth } from "@/components/extractions/require-auth";
import { OrganizationSelect } from "@/components/extractions/organization-select";
import { ProfilLabelForm } from "@/components/extractions/profil-label";
import { useSession } from "@/hooks/use-session";
import {
  getLabelProfile,
  organizationsQuery,
  organizationSearch,
  selectOrganization,
} from "@/lib/backend";

export const Route = createFileRoute("/label")({
  ssr: false,
  validateSearch: organizationSearch,
  head: () =>
    metadata(
      "Mon label",
      "Noms, préfixes UPC et codes ISRC de votre label, pour séparer son catalogue.",
    ),
  component: () => (
    <Shell active="label">
      <main className="content-page">
        <RequireAuth>
          <MonLabel />
        </RequireAuth>
      </main>
    </Shell>
  ),
});

function MonLabel() {
  const { session } = useSession();
  const { label } = Route.useSearch();
  const navigate = useNavigate();
  const org = useQuery(organizationsQuery(session?.user.id));
  const selected = selectOrganization(org.data, label);
  const orgId = selected?.id;
  const profil = useQuery({
    queryKey: ["label-profil", orgId],
    queryFn: () => getLabelProfile(orgId ?? ""),
    enabled: Boolean(orgId),
    retry: false,
  });

  return (
    <>
      <div className="eyebrow">
        <span className="small-line" />{" "}
        {selected ? `LABEL · ${selected.name.toUpperCase()}` : "LABEL"}
      </div>
      <h1>Mon label</h1>
      <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
        Ces informations servent à savoir quelles sorties et quels titres appartiennent à votre
        label. Un artiste peut sortir ailleurs : seules les données de votre label sont classées «
        Mon label ».
      </p>

      <OrganizationSelect
        organizations={org.data}
        selected={selected}
        onSelect={(id) => void navigate({ to: "/label", search: { label: id } })}
      />

      {(org.isLoading || profil.isLoading) && (
        <p className="mt-6 flex items-center gap-2 text-muted-foreground">
          <LoaderCircle className="animate-spin" size={16} /> Chargement…
        </p>
      )}
      {(org.error || profil.error) && (
        <p className="mt-6 text-destructive" role="alert">
          {String((org.error ?? profil.error)?.message)}
        </p>
      )}
      {orgId && !profil.isLoading && (
        <ProfilLabelForm key={orgId} orgId={orgId} profil={profil.data ?? null} />
      )}
    </>
  );
}
