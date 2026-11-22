import { useState, type FormEvent } from "react";
import { createFileRoute, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle, Mail, UserMinus, UserPlus, X } from "lucide-react";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Shell, metadata } from "@/components/label-pulse/shared";
import { RequireAuth } from "@/components/extractions/require-auth";
import { OrganizationSelect } from "@/components/extractions/organization-select";
import { useSession } from "@/hooks/use-session";
import {
  inviteMember,
  isOwner,
  listInvitations,
  listMembers,
  organizationsQuery,
  organizationSearch,
  removeMember,
  revokeInvitation,
  selectOrganization,
} from "@/lib/backend";
import { dateFr } from "@/lib/libelles";

export const Route = createFileRoute("/membres")({
  ssr: false,
  validateSearch: organizationSearch,
  head: () =>
    metadata("Membres du label", "Les personnes qui partagent les extractions de votre label."),
  component: () => (
    <Shell active="membres">
      <main className="content-page">
        <RequireAuth>
          <Membres />
        </RequireAuth>
      </main>
    </Shell>
  ),
});

const ROLES = { owner: "Propriétaire", member: "Membre" } as const;

function Membres() {
  const { session } = useSession();
  const userId = session?.user.id;
  const { label } = Route.useSearch();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const org = useQuery(organizationsQuery(userId));
  const selected = selectOrganization(org.data, label);
  const orgId = selected?.id;

  const members = useQuery({
    queryKey: ["membres", orgId],
    queryFn: () => listMembers(orgId!),
    enabled: Boolean(orgId),
  });
  const invitations = useQuery({
    queryKey: ["invitations", orgId],
    queryFn: () => listInvitations(orgId!),
    enabled: Boolean(orgId),
  });
  const owner = isOwner(members.data, userId);

  const refresh = () =>
    Promise.all([
      queryClient.invalidateQueries({ queryKey: ["membres", orgId] }),
      queryClient.invalidateQueries({ queryKey: ["invitations", orgId] }),
    ]);
  const invite = useMutation({
    mutationFn: (email: string) => inviteMember(orgId!, email),
    onSuccess: refresh,
  });
  const revoke = useMutation({ mutationFn: revokeInvitation, onSuccess: refresh });
  const remove = useMutation({
    mutationFn: (memberId: string) => removeMember(orgId!, memberId),
    onSuccess: refresh,
  });

  const [email, setEmail] = useState("");
  const [invited, setInvited] = useState<string | null>(null);
  function submit(event: FormEvent) {
    event.preventDefault();
    const value = email.trim();
    if (!value) return;
    setInvited(null);
    invite.mutate(value, {
      onSuccess: () => {
        setInvited(value);
        setEmail("");
      },
    });
  }

  const error = org.error ?? members.error ?? invitations.error ?? revoke.error ?? remove.error;

  return (
    <>
      <div className="eyebrow">
        <span className="small-line" />{" "}
        {selected ? `LABEL · ${selected.name.toUpperCase()}` : "LABEL"}
      </div>
      <h1>Membres</h1>
      <p className="mt-2 max-w-2xl text-muted-foreground">
        Les membres du label voient et lancent les mêmes extractions. Personne d’autre n’y a accès.
      </p>

      <OrganizationSelect
        organizations={org.data}
        selected={selected}
        onSelect={(id) => void navigate({ to: "/membres", search: { label: id } })}
      />

      {(org.isLoading || members.isLoading) && (
        <p className="mt-6 flex items-center gap-2 text-muted-foreground" role="status">
          <LoaderCircle className="animate-spin" size={16} /> Chargement…
        </p>
      )}
      {error && (
        <p className="mt-6 text-destructive" role="alert">
          {error.message}
        </p>
      )}

      {members.data && (
        <section className="mt-8" aria-labelledby="titre-membres">
          <h2 id="titre-membres" className="text-lg font-semibold">
            {members.data.length} membre{members.data.length > 1 ? "s" : ""}
          </h2>
          <ul className="mt-3 grid gap-2">
            {members.data.map((member) => (
              <li
                key={member.user_id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4"
              >
                <div>
                  <strong>{member.email ?? "Compte supprimé"}</strong>
                  {member.user_id === userId && (
                    <span className="text-muted-foreground"> (vous)</span>
                  )}
                  <div className="mt-1 text-sm text-muted-foreground">
                    Membre depuis le {dateFr(member.joined_at)}
                  </div>
                </div>
                <span className="flex items-center gap-2">
                  <Badge variant={member.role === "owner" ? "default" : "secondary"}>
                    {ROLES[member.role]}
                  </Badge>
                  {owner && member.user_id !== userId && (
                    <AlertDialog>
                      <AlertDialogTrigger asChild>
                        <Button
                          variant="ghost"
                          size="sm"
                          disabled={remove.isPending}
                          aria-label={`Retirer ${member.email ?? "ce membre"} du label`}
                        >
                          <UserMinus /> Retirer
                        </Button>
                      </AlertDialogTrigger>
                      <AlertDialogContent>
                        <AlertDialogHeader>
                          <AlertDialogTitle>
                            Retirer {member.email ?? "ce membre"} du label ?
                          </AlertDialogTitle>
                          <AlertDialogDescription>
                            Cette personne n’aura plus accès aux extractions du label. Pour la
                            rétablir, il faudra l’inviter à nouveau.
                          </AlertDialogDescription>
                        </AlertDialogHeader>
                        <AlertDialogFooter>
                          <AlertDialogCancel>Annuler</AlertDialogCancel>
                          <AlertDialogAction onClick={() => remove.mutate(member.user_id)}>
                            Retirer
                          </AlertDialogAction>
                        </AlertDialogFooter>
                      </AlertDialogContent>
                    </AlertDialog>
                  )}
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {owner && (
        <section className="mt-10 max-w-xl" aria-labelledby="titre-inviter">
          <h2 id="titre-inviter" className="text-lg font-semibold">
            Inviter une personne
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Elle rejoint le label dès qu’elle se connecte avec cette adresse. Aucun e-mail n’est
            envoyé : transmettez-lui le lien de Zikindé.
          </p>
          <form onSubmit={submit} className="mt-4 flex flex-wrap items-end gap-3" noValidate>
            <div className="grid flex-1 gap-2" style={{ minWidth: "min(100%, 16rem)" }}>
              <Label htmlFor="invite-email">E-mail</Label>
              <Input
                id="invite-email"
                type="email"
                autoComplete="off"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" disabled={invite.isPending || !email.trim()}>
              {invite.isPending ? <LoaderCircle className="animate-spin" /> : <UserPlus />}
              Inviter
            </Button>
          </form>
          {invite.error && (
            <p className="mt-2 text-sm text-destructive" role="alert">
              {invite.error.message}
            </p>
          )}
          {invited && (
            <p className="mt-2 text-sm text-muted-foreground" role="status">
              {invited} est invité·e.
            </p>
          )}
        </section>
      )}

      {invitations.data && invitations.data.length > 0 && (
        <section className="mt-10" aria-labelledby="titre-invitations">
          <h2 id="titre-invitations" className="text-lg font-semibold">
            Invitations en attente
          </h2>
          <ul className="mt-3 grid gap-2">
            {invitations.data.map((invitation) => (
              <li
                key={invitation.id}
                className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-dashed p-4"
              >
                <div>
                  <span className="flex items-center gap-2">
                    <Mail size={16} /> {invitation.email}
                  </span>
                  <div className="mt-1 text-sm text-muted-foreground">
                    Invité·e le {dateFr(invitation.created_at)}
                  </div>
                </div>
                {owner && (
                  <Button
                    variant="ghost"
                    size="sm"
                    disabled={revoke.isPending}
                    onClick={() => revoke.mutate(invitation.id)}
                    aria-label={`Annuler l’invitation de ${invitation.email}`}
                  >
                    <X /> Annuler
                  </Button>
                )}
              </li>
            ))}
          </ul>
        </section>
      )}
    </>
  );
}
