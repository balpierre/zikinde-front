import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowRight, LoaderCircle, Plus } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Shell, metadata } from "@/components/label-pulse/shared";
import { RequireAuth } from "@/components/extractions/require-auth";
import { ensureOrganization, listArtists } from "@/lib/backend";
import { artistesStatuts, nomSource } from "@/lib/extraction-libelles";
import { dateFr } from "@/lib/libelles";

export const Route = createFileRoute("/extractions/")({
  ssr: false,
  head: () =>
    metadata("Extractions", "Les artistes suivis par votre label et l’état de leurs extractions."),
  component: () => (
    <Shell>
      <main className="content-page">
        <RequireAuth>
          <Extractions />
        </RequireAuth>
      </main>
    </Shell>
  ),
});

function Extractions() {
  const org = useQuery({ queryKey: ["organisation"], queryFn: ensureOrganization });
  const artists = useQuery({
    queryKey: ["artistes"],
    queryFn: listArtists,
    enabled: org.isSuccess,
    refetchInterval: (query) =>
      query.state.data?.some((a) => a.status === "collecting") ? 3000 : false,
  });

  return (
    <>
      <div className="eyebrow">
        <span className="small-line" />{" "}
        {org.data ? `LABEL · ${org.data.name.toUpperCase()}` : "LABEL"}
      </div>
      <div className="flex flex-wrap items-end justify-between gap-4">
        <h1>Extractions</h1>
        <Button asChild>
          <Link to="/">
            <Plus /> Nouvelle extraction
          </Link>
        </Button>
      </div>

      {(org.isLoading || artists.isLoading) && (
        <p className="mt-6 flex items-center gap-2 text-muted-foreground">
          <LoaderCircle className="animate-spin" size={16} /> Chargement…
        </p>
      )}
      {(org.error || artists.error) && (
        <p className="mt-6 text-destructive" role="alert">
          {String((org.error ?? artists.error)?.message)}
        </p>
      )}
      {artists.data?.length === 0 && (
        <p className="mt-6 text-muted-foreground">
          Aucun artiste suivi pour l’instant. Lancez une première extraction depuis la recherche.
        </p>
      )}

      <ul className="mt-6 grid gap-3">
        {artists.data?.map((artist) => (
          <li key={artist.id}>
            <Link
              to="/extractions/$artistId"
              params={{ artistId: artist.id }}
              className="flex flex-wrap items-center justify-between gap-3 rounded-lg border p-4 hover:bg-accent"
            >
              <div>
                <strong className="text-lg">{artist.name}</strong>
                <div className="mt-1 text-sm text-muted-foreground">
                  {artist.last_collected_at
                    ? `Dernière collecte : ${dateFr(artist.last_collected_at)}`
                    : "Jamais collecté"}
                  {" · "}
                  {Object.keys(artist.known_ids)
                    .filter((k) => !["isni", "ipi"].includes(k))
                    .map(nomSource)
                    .join(", ") || "sources à découvrir"}
                </div>
              </div>
              <span className="flex items-center gap-3">
                <Badge variant={artist.status === "error" ? "destructive" : "secondary"}>
                  {artist.status === "collecting" && (
                    <LoaderCircle className="animate-spin" size={12} />
                  )}
                  {artistesStatuts[artist.status]}
                </Badge>
                <ArrowRight size={18} />
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </>
  );
}
