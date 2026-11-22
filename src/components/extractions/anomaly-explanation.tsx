import { useMutation, useQueryClient } from "@tanstack/react-query";
import { LoaderCircle } from "lucide-react";
import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import {
  anomalyExplanationsOptions,
  requestAnomalyExplanation,
  watchJob,
  type AnomalyExplanation,
} from "@/lib/backend";
import { nomSource } from "@/lib/extraction-libelles";

function publicSourceUrl(raw: string) {
  try {
    const url = new URL(raw);
    if (
      url.protocol === "https:" &&
      ["musicbrainz.org", "wikidata.org", "www.wikidata.org"].includes(url.hostname)
    )
      return url.href;
  } catch {
    // Une URL indisponible laisse l'identifiant et l'observation lisibles.
  }
  return null;
}

export function AnomalyExplanationCard({
  artistId,
  anomalyId,
  report,
}: {
  artistId: string;
  anomalyId: number;
  report?: AnomalyExplanation | undefined;
}) {
  const client = useQueryClient();
  const [requestedJobId, setRequestedJobId] = useState<string>();
  const [refreshFailed, setRefreshFailed] = useState(false);
  const request = useMutation({
    mutationFn: () => requestAnomalyExplanation(anomalyId),
    onSuccess: setRequestedJobId,
  });
  const jobId =
    requestedJobId ??
    (report?.status === "running" || report?.status === "queued" ? report.job_id : undefined);

  useEffect(() => {
    if (!jobId || refreshFailed) return;
    let mounted = true;
    const stop = watchJob(jobId, (job) => {
      if (job.status !== "done" && job.status !== "error") return;
      void client
        .invalidateQueries(
          { queryKey: anomalyExplanationsOptions(artistId).queryKey },
          { throwOnError: true },
        )
        .catch(() => {
          if (mounted) setRefreshFailed(true);
        })
        .finally(() => {
          if (mounted) setRequestedJobId(undefined);
        });
    });
    return () => {
      mounted = false;
      stop();
    };
  }, [artistId, client, jobId, refreshFailed]);

  const explanation = report?.status === "done" ? report.explanation : null;
  if (explanation) {
    return (
      <section className="mt-3 space-y-2 rounded-md border bg-muted/30 p-3" lang="en">
        <p>
          <strong className="block">Model explanation</strong>
          {explanation.summary}
        </p>
        <p>
          <strong className="block">Recommended check</strong>
          {explanation.next_action}
        </p>
        <details>
          <summary className="cursor-pointer font-medium">Source evidence</summary>
          <ul className="mt-2 space-y-2 break-words">
            {explanation.evidence.map((item) => {
              const url = publicSourceUrl(item.url);
              const source = `${nomSource(item.source)} · ${item.source_id}`;
              return (
                <li key={item.id}>
                  <p>{item.value}</p>
                  <p className="text-xs text-muted-foreground">
                    {url ? (
                      <a href={url} className="underline" target="_blank" rel="noreferrer">
                        {source}
                      </a>
                    ) : (
                      source
                    )}
                    {" · Collected "}
                    <time dateTime={item.fetched_at}>
                      {new Date(item.fetched_at).toLocaleDateString("en-GB", { timeZone: "UTC" })}
                    </time>
                  </p>
                </li>
              );
            })}
          </ul>
        </details>
      </section>
    );
  }

  const pending = request.isPending || (!!jobId && !refreshFailed);
  const failed = request.isError || report?.status === "error" || refreshFailed;
  return (
    <div className="mt-3 space-y-2" lang="en">
      {pending ? (
        <p className="flex items-center gap-2 text-muted-foreground" role="status">
          <LoaderCircle className="animate-spin" size={14} aria-hidden="true" />
          Generating explanation…
        </p>
      ) : (
        <>
          {failed && <p role="alert">Could not load the explanation.</p>}
          <Button
            variant="outline"
            size="sm"
            onClick={() => {
              setRefreshFailed(false);
              request.mutate();
            }}
          >
            {failed ? "Retry explanation" : "Explain"}
          </Button>
        </>
      )}
    </div>
  );
}
