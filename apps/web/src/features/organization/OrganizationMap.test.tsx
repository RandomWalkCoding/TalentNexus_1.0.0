import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { OrganizationMap } from "./OrganizationMap";

afterEach(() => vi.unstubAllGlobals());

describe("OrganizationMap", () => {
  it("opens a node, shows source evidence and reviews it", async () => {
    const unit = { id: "org-1", companyId: "company-1", parentId: null, name: "Northstar AI", kind: "company", region: "上海", role: null, status: "pending", version: 1, childrenCount: 0, evidenceCount: 1, updatedAt: "2026-10-01T00:00:00.000Z" };
    const evidence = { id: "evidence-1", organizationUnitId: "org-1", title: "团队扩张信号", excerpt: "正在扩充产品团队", collectedAt: "2026-10-01T00:00:00.000Z", confidence: 88, status: "pending", reviewNote: null, reviewedAt: null, source: { id: "source-1", name: "研究来源", url: "https://example.com" } };
    const fetchMock = vi.fn(async (input: string, options?: { method?: string }) => {
      if (options?.method === "PATCH") return { ok: true, json: async () => ({ item: { ...evidence, status: "verified" }, requestId: "req-2" }) };
      if (input.endsWith("/org-1")) return { ok: true, json: async () => ({ ...unit, evidence: [evidence], children: [], requestId: "req-1" }) };
      return { ok: true, json: async () => ({ items: [unit], total: 1, page: 1, pageSize: 100, requestId: "req-0" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><OrganizationMap canWrite /></MemoryRouter>);
    fireEvent.click(await screen.findByRole("button", { name: /Northstar AI/ }));
    expect(await screen.findByText("团队扩张信号")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /核验/ }));
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/organizations/evidence/evidence-1", expect.objectContaining({ method: "PATCH" })));
  });
});
