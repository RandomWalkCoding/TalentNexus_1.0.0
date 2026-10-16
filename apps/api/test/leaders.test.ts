import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { demoActor } from "../src/modules/admin.js";

const companyId = "20000000-0000-4000-8000-000000000001";
const otherCompanyId = "20000000-0000-4000-8000-000000000002";
const leaderId = "23000000-0000-4000-8000-000000000001";
const unitId = "21000000-0000-4000-8000-000000000001";
const taskId = "task-1";
const leader = {
  id: leaderId,
  companyId,
  organizationUnitId: unitId,
  name: "林予安",
  currentTitle: "亚太产品负责人",
  previousTitles: ["产品总监"],
  regions: ["中国", "新加坡"],
  teamSummary: "负责区域产品与商业化团队",
  contactChannels: ["公开邮箱"],
  status: "unverified",
  version: 1,
  updatedAt: new Date("2026-10-01T00:00:00.000Z"),
  researchTasks: [{ researchTaskId: taskId }]
};

describe("leader profile API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists, creates and updates leader profiles with company validation", async () => {
    vi.spyOn(prisma.leaderProfile, "findMany").mockResolvedValue([leader] as never);
    vi.spyOn(prisma.leaderProfile, "count").mockResolvedValue(1);
    vi.spyOn(prisma.leaderProfile, "findUnique").mockResolvedValue(leader as never);
    vi.spyOn(prisma.company, "findUnique").mockResolvedValue({ id: companyId } as never);
    vi.spyOn(prisma.leaderProfile, "create").mockResolvedValue(leader as never);
    vi.spyOn(prisma.leaderProfile, "update").mockResolvedValue({ ...leader, name: "林予安（已确认）" } as never);

    const app = buildApp({ identity: () => demoActor });
    const list = await app.inject({ method: "GET", url: `/api/v1/leaders?companyId=${companyId}&q=产品` });
    expect(list.statusCode).toBe(200);
    expect(list.json().items[0]).toMatchObject({ name: "林予安", researchTaskIds: [taskId] });

    const created = await app.inject({ method: "POST", url: "/api/v1/leaders", payload: { companyId, name: "林予安", currentTitle: "亚太产品负责人" } });
    expect(created.statusCode).toBe(201);

    const updated = await app.inject({ method: "PATCH", url: `/api/v1/leaders/${leaderId}`, payload: { name: "林予安（已确认）" } });
    expect(updated.statusCode).toBe(200);
    expect(updated.json().item.name).toBe("林予安（已确认）");
    await app.close();
  });

  it("links leaders to research tasks and rejects cross-company links", async () => {
    vi.spyOn(prisma.researchTask, "findUnique")
      .mockResolvedValueOnce({ id: taskId, companyId } as never)
      .mockResolvedValueOnce({ id: taskId, companyId: otherCompanyId } as never);
    vi.spyOn(prisma.leaderProfile, "findUnique").mockResolvedValue(leader as never);
    vi.spyOn(prisma.researchTaskLeader, "upsert").mockResolvedValue({} as never);

    const app = buildApp({ identity: () => demoActor });
    const linked = await app.inject({ method: "POST", url: `/api/v1/research-tasks/${taskId}/leaders/${leaderId}` });
    expect(linked.statusCode).toBe(200);
    expect(linked.json().ok).toBe(true);

    const conflict = await app.inject({ method: "POST", url: `/api/v1/research-tasks/${taskId}/leaders/${leaderId}` });
    expect(conflict.statusCode).toBe(409);
    await app.close();
  });

  it("returns not found for missing leaders", async () => {
    vi.spyOn(prisma.leaderProfile, "findUnique").mockResolvedValue(null);
    const app = buildApp({ identity: () => demoActor });
    const response = await app.inject({ method: "GET", url: `/api/v1/leaders/${leaderId}` });
    expect(response.statusCode).toBe(404);
    await app.close();
  });

  it("returns and reviews source-backed leader evidence", async () => {
    const evidence = { id: "24000000-0000-4000-8000-000000000001", leaderId, title: "招聘信息", excerpt: "覆盖亚太团队", collectedAt: new Date("2026-10-02T00:00:00.000Z"), confidence: 84, status: "pending", source: { id: "10000000-0000-4000-8000-000000000002", name: "示例招聘观察", url: "https://jobs.example.com" } };
    vi.spyOn(prisma.leaderProfile, "findUnique")
      .mockResolvedValueOnce({ ...leader, evidences: [evidence] } as never)
      .mockResolvedValueOnce(leader as never);
    vi.spyOn(prisma.source, "findUnique").mockResolvedValue(evidence.source as never);
    vi.spyOn(prisma.leaderEvidence, "create").mockResolvedValue(evidence as never);
    vi.spyOn(prisma.leaderEvidence, "findUnique").mockResolvedValue({ ...evidence, sourceId: evidence.source.id } as never);
    vi.spyOn(prisma.leaderEvidence, "update").mockResolvedValue({ ...evidence, status: "verified" } as never);

    const app = buildApp({ identity: () => demoActor });
    const detail = await app.inject({ method: "GET", url: `/api/v1/leaders/${leaderId}` });
    expect(detail.statusCode).toBe(200);
    expect(detail.json().evidence[0].source.name).toBe("示例招聘观察");
    const created = await app.inject({ method: "POST", url: `/api/v1/leaders/${leaderId}/evidence`, payload: { sourceId: evidence.source.id, title: evidence.title, excerpt: evidence.excerpt, collectedAt: evidence.collectedAt.toISOString(), confidence: evidence.confidence } });
    expect(created.statusCode).toBe(201);
    const reviewed = await app.inject({ method: "PATCH", url: `/api/v1/leaders/evidence/${evidence.id}`, payload: { status: "verified" } });
    expect(reviewed.statusCode).toBe(200);
    await app.close();
  });
});
