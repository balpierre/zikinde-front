import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AnomalyExplanationCard } from "@/components/extractions/anomaly-explanation";
import { requestAnomalyExplanation, watchJob } from "@/lib/backend";

vi.mock("@/lib/backend", () => ({
  requestAnomalyExplanation: vi.fn(),
  watchJob: vi.fn(() => () => {}),
}));

describe("Anomaly explanation", () => {
  it("queues an explanation on demand and follows its progress", async () => {
    vi.mocked(requestAnomalyExplanation).mockResolvedValue("job-id");
    render(
      <QueryClientProvider client={new QueryClient()}>
        <AnomalyExplanationCard artistId="artist-id" anomalyId={12} />
      </QueryClientProvider>,
    );
    expect(requestAnomalyExplanation).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: "Explain" }));
    expect(await screen.findByText("Generating explanation…")).toBeVisible();
    expect(requestAnomalyExplanation).toHaveBeenCalledWith(12);
    expect(watchJob).toHaveBeenCalledWith("job-id", expect.any(Function));
  });
});
