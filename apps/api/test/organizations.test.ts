import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { demoActor } from "../src/modules/admin.js";

const source = { id: "10000000-0000-4000-8000-000000000001", name: "示例科技日报", url: "https://news.example.com" };
const unit = { id: "21000000-0000-4000-8000-000000000001", companyId: "20000000-0000-4000-8000-000000000001", parentId: null, name: "企业产品部", kind: "team", region: "上海", role: "产品与解决方案", status: "unverified", version: 1, updatedAt: new Date(), _count: { children: 0, evidences: 0 } };

describe("organization evidence API", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists organization nodes and returns detail with evidence", async () => {
    vi.spyOn(prisma.organizationUnit, "findMany").mockResolvedValue([unit] as never);
    vi.spyOn(prisma.organizationUnit, "count").mockResolvedValue(1);
    vi.spyOn(prisma.organizationUnit, "findUnique").mockResolvedValue({ ...unit, children: [], evidences: [] } as never);
    const app = buildApp({ identity: () => demoActor });
    const list = await app.inject("/api/v1/organizations?companyId=20000000-0000-4000-8000-000000000001");
    expect(list.statusCode).toBe(200);
    expect(list.json().items[0].name).toBe("企业产品部");
    const detail = await app.inject(`/api/v1/organizations/${unit.id}`);
    expect(detail.statusCode).toBe(200);
    expect(detail.json().evidence).toEqual([]);
    await app.close();
  });

  it("creates and reviews evidence with validation and not-found handling", async () => {
    vi.spyOn(prisma.organizationUnit, "findUnique").mockResolvedValue(unit as never);
    vi.spyOn(prisma.source, "findUnique").mockResolvedValue(source as never);
    const evidence = { id: "22000000-0000-4000-8000-000000000001", organizationUnitId: unit.id, title: "公开招聘信息", excerpt: "团队正在招聘负责人", collectedAt: new Date(), confidence: 82, status: "pending", reviewNote: null, reviewedAt: null, source };
    vi.spyOn(prisma.evidence, "create").mockResolvedValue(evidence as never);
    vi.spyOn(prisma.evidence, "findUnique")
      .mockResolvedValueOnce(evidence as never)
      .mockResolvedValueOnce(null);
    vi.spyOn(prisma.evidence, "update").mockResolvedValue({ ...evidence, status: "verified", reviewNote: "已核验" } as never);
    const app = buildApp({ identity: () => demoActor });
    expect((await app.inject({ method: "POST", url: `/api/v1/organizations/${unit.id}/evidence`, payload: { sourceId: source.id, title: "公开招聘信息", excerpt: "团队正在招聘负责人", collectedAt: new Date().toISOString(), confidence: 82 } })).statusCode).toBe(201);
    expect((await app.inject({ method: "PATCH", url: `/api/v1/organizations/evidence/${evidence.id}`, payload: { status: "verified", reviewNote: "已核验" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "PATCH", url: "/api/v1/organizations/evidence/missing", payload: { status: "verified" } })).statusCode).toBe(404);
    await app.close();
  });
});
