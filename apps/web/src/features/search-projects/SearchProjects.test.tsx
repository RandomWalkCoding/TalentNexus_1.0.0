import { fireEvent, render, screen, waitFor } from "@testing-library/react";
import { MemoryRouter } from "react-router-dom";
import { afterEach, describe, expect, it, vi } from "vitest";
import { SearchProjects } from "./SearchProjects";

afterEach(() => vi.unstubAllGlobals());

describe("SearchProjects", () => {
  it("renders the funnel and moves a candidate to the next stage", async () => {
    const project = { id: "25000000-0000-4000-8000-000000000001", name: "亚太产品负责人寻访", companyId: null, targetRole: "产品负责人", regions: ["中国"], owner: "Rachel", status: "active", targetCount: 1, deadline: "2026-11-01", summary: "搭建候选人名单", candidateCount: 1, updatedAt: "2026-10-01T00:00:00.000Z" };
    const candidate = { id: "26000000-0000-4000-8000-000000000001", projectId: project.id, talentId: "talent-1", stage: "longlist", source: "研究任务", nextActionAt: null, feedback: null, talent: { id: "talent-1", name: "林予安", title: "资深产品经理", company: "Northstar AI", location: "上海", category: "产品", tags: ["AI"], level: "P5", updatedAt: "2026-09-28T00:00:00.000Z" } };
    const detail = { ...project, candidates: [candidate] };
    const fetchMock = vi.fn(async (input: string, options?: { method?: string }) => {
      if (options?.method === "PATCH") return { ok: true, json: async () => ({ item: { ...candidate, stage: "shortlist" }, requestId: "req-2" }) };
      if (input.endsWith("/" + project.id)) return { ok: true, json: async () => ({ ...detail, requestId: "req-1" }) };
      return { ok: true, json: async () => ({ items: [project], total: 1, page: 1, pageSize: 50, requestId: "req-0" }) };
    });
    vi.stubGlobal("fetch", fetchMock);
    render(<MemoryRouter><SearchProjects canWrite /></MemoryRouter>);
    expect(await screen.findByText("林予安")).toBeInTheDocument();
    fireEvent.change(screen.getByRole("combobox", { name: "林予安 的阶段" }), { target: { value: "shortlist" } });
    await waitFor(() => expect(fetchMock).toHaveBeenCalledWith("/api/v1/search-projects/" + project.id + "/candidates/" + candidate.id, expect.objectContaining({ method: "PATCH" })));
  });
});
