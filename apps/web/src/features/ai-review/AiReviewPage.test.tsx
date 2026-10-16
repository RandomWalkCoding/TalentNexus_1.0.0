import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { AiReviewPage } from "./AiReviewPage";

describe("AiReviewPage", () => {
  it("shows review queue and submits an acceptance", async () => {
    const review = {
      id: "31000000-0000-4000-8000-000000000001", taskId: "30000000-0000-4000-8000-000000000001",
      entityType: "organization-unit", entityId: "org-1", status: "pending", proposed: { name: "亚太产品与商业化" },
      evidenceIds: [], reviewerId: null, reviewNote: null, version: 1, createdAt: "2026-10-14T08:00:00.000Z"
    };
    const snapshot = {
      id: "32000000-0000-4000-8000-000000000001", metric: "exchange-rate", source: "Demo",
      sourceUrl: "https://example.com", license: "demo", version: "fx-1", publishedAt: "2026-10-14T08:00:00.000Z",
      validFrom: "2026-10-01", validUntil: "2026-10-31", status: "published", stale: false,
      observations: [{ key: "USD/CNY", value: 7.12, unit: "CNY per USD", observedAt: "2026-10-14" }],
      checksum: "x", supersedesId: null, createdAt: "2026-10-14T08:00:00.000Z"
    };
    const fetchMock = vi.spyOn(globalThis, "fetch").mockImplementation(async (input) => {
      if (String(input).includes("/ai/reviews/")) return new Response(JSON.stringify({ item: { ...review, status: "accepted", version: 2 } }), { status: 200 });
      if (String(input).includes("/ai/reviews")) return new Response(JSON.stringify({ items: [review] }), { status: 200 });
      return new Response(JSON.stringify({ items: [snapshot] }), { status: 200 });
    });
    render(<AiReviewPage />);
    expect(await screen.findByText("组织关系建议")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /接受/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith(expect.stringContaining("/ai/reviews/"), expect.objectContaining({ method: "PATCH" })));
    expect(screen.getByText("汇率 · fx-1")).toBeInTheDocument();
    fetchMock.mockRestore();
  });
});
