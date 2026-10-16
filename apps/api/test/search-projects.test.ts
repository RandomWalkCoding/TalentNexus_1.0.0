import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { demoActor } from "../src/modules/admin.js";

const projectId = "25000000-0000-4000-8000-000000000001";
const talentId = "talent-1";
const project = { id: projectId, name: "亚太产品负责人寻访", companyId: "20000000-0000-4000-8000-000000000001", targetRole: "产品负责人", regions: ["中国", "新加坡"], owner: "Rachel", status: "active", targetCount: 5, deadline: "2026-11-01", summary: "搭建候选人长短名单", updatedAt: new Date("2026-10-01T00:00:00.000Z"), _count: { candidates: 1 } };
const talent = { id: talentId, name: "林予安", title: "资深产品经理", company: "Northstar AI", location: "上海", category: "产品", tags: ["AI"], level: "P5", updatedAt: new Date("2026-09-28T00:00:00.000Z") };
const candidate = { id: "26000000-0000-4000-8000-000000000001", projectId, talentId, stage: "longlist", source: "研究任务", nextActionAt: null, feedback: null, talent };

describe("search projects API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists projects and returns candidate details", async () => {
    vi.spyOn(prisma.searchProject, "findMany").mockResolvedValue([{ ...project, _count: { candidates: 0 } }] as never);
    vi.spyOn(prisma.searchProject, "count").mockResolvedValue(1);
    vi.spyOn(prisma.searchProject, "findUnique").mockResolvedValue({ ...project, candidates: [candidate] } as never);
    const app = buildApp({ identity: () => demoActor });
    const list = await app.inject({ method: "GET", url: "/api/v1/search-projects?status=active&q=产品" });
    expect(list.statusCode).toBe(200);
    expect(list.json().items[0].candidateCount).toBe(0);
    const detail = await app.inject({ method: "GET", url: `/api/v1/search-projects/${projectId}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().candidates[0]).toMatchObject({ stage: "longlist", talent: { name: "林予安" } });
    await app.close();
  });

  it("creates a project, adds a candidate, changes stage and shows cross-project history", async () => {
    vi.spyOn(prisma.company, "findUnique").mockResolvedValue({ id: project.companyId } as never);
    vi.spyOn(prisma.searchProject, "create").mockResolvedValue({ ...project, _count: { candidates: 0 } } as never);
    vi.spyOn(prisma.searchProject, "findUnique")
      .mockResolvedValueOnce(project as never)
      .mockResolvedValueOnce(project as never);
    vi.spyOn(prisma.talent, "findUnique").mockResolvedValue(talent as never);
    vi.spyOn(prisma.candidateProject, "create").mockResolvedValue(candidate as never);
    vi.spyOn(prisma.candidateProject, "findUnique").mockResolvedValue(candidate as never);
    vi.spyOn(prisma.candidateProject, "update").mockResolvedValue({ ...candidate, stage: "shortlist" } as never);
    vi.spyOn(prisma.candidateProject, "findMany").mockResolvedValue([{ ...candidate, project: { id: projectId, name: project.name, status: "active" } }] as never);

    const app = buildApp({ identity: () => demoActor });
    const created = await app.inject({ method: "POST", url: "/api/v1/search-projects", payload: { name: project.name, companyId: project.companyId, targetRole: project.targetRole, regions: project.regions, owner: project.owner, summary: project.summary } });
    expect(created.statusCode).toBe(201);
    const added = await app.inject({ method: "POST", url: `/api/v1/search-projects/${projectId}/candidates`, payload: { talentId, stage: "longlist", source: "研究任务" } });
    expect(added.statusCode).toBe(201);
    const moved = await app.inject({ method: "PATCH", url: `/api/v1/search-projects/${projectId}/candidates/${candidate.id}`, payload: { stage: "shortlist" } });
    expect(moved.statusCode).toBe(200);
    expect(moved.json().item.stage).toBe("shortlist");
    const history = await app.inject({ method: "GET", url: `/api/v1/search-projects/candidates/${talentId}/history` });
    expect(history.statusCode).toBe(200);
    expect(history.json().items[0].project.name).toBe(project.name);
    await app.close();
  });

  it("reports duplicate candidates and missing projects", async () => {
    vi.spyOn(prisma.searchProject, "findUnique").mockResolvedValue(null);
    const app = buildApp({ identity: () => demoActor });
    const missing = await app.inject({ method: "GET", url: `/api/v1/search-projects/${projectId}` });
    expect(missing.statusCode).toBe(404);
    await app.close();
  });
});
