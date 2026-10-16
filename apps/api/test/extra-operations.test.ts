import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import { createMemoryWorkflowRepository } from "../src/modules/workflow-repository.js";

const app = buildApp({ workflowRepository: createMemoryWorkflowRepository() });
afterAll(async () => app.close());

describe("workflow demonstration endpoints", () => {
  it("validates pagination and filters by the domain field", async () => {
    const invalid = await app.inject({ method: "GET", url: "/api/v1/leads?page=oops" });
    expect(invalid.statusCode).toBe(400);
    const filtered = await app.inject({ method: "GET", url: "/api/v1/leads?filter=qualified&pageSize=1" });
    expect(filtered.json()).toMatchObject({ total: 1, page: 1, pageSize: 1, items: [{ id: "lead-1" }] });
    const second = await app.inject({ method: "GET", url: "/api/v1/talents?pageSize=1&page=2" });
    expect(second.json()).toMatchObject({ total: 5, page: 2, items: [{ id: "talent-2" }] });
  });

  it("rejects invalid updates without modifying the stored item", async () => {
    const before = (await app.inject({ method: "GET", url: "/api/v1/research-tasks/task-1" })).json();
    for (const payload of [{ status: "invalid" }, { stage: "won" }, {}]) {
      const invalid = await app.inject({ method: "PATCH", url: "/api/v1/research-tasks/task-1", payload });
      expect(invalid.statusCode).toBe(400);
      expect((await app.inject({ method: "GET", url: "/api/v1/research-tasks/task-1" })).json()).toEqual(before);
    }
    const valid = await app.inject({ method: "PATCH", url: "/api/v1/research-tasks/task-1", payload: { status: "done" } });
    expect(valid.json()).toMatchObject({ ok: true, item: { status: "done" } });
  });

  it("supports categorization and mapping edits", async () => {
    const categories = await app.inject({ method: "GET", url: "/api/v1/talent-categories" });
    expect(categories.statusCode).toBe(200);
    expect(categories.json().items).toMatchObject([{ name: "产品", count: 1 }, { name: "商业化", count: 1 }, { name: "技术", count: 2 }, { name: "未分类", count: 1 }]);
    const invalidCategory = await app.inject({ method: "PATCH", url: "/api/v1/talents/talent-5", payload: { category: "不存在" } });
    expect(invalidCategory.statusCode).toBe(400);
    const talent = await app.inject({ method: "PATCH", url: "/api/v1/talents/talent-5", payload: { category: "产品" } });
    expect(talent.json().item.category).toBe("产品");
    const mapping = await app.inject({ method: "PATCH", url: "/api/v1/mapping/mapping-1", payload: { target: "P6", confidence: 80 } });
    expect(mapping.json().item).toMatchObject({ target: "P6", confidence: 80 });
  });

  it("creates a talent category idempotently", async () => {
    const created = await app.inject({ method: "POST", url: "/api/v1/talent-categories", payload: { name: "数据" } });
    expect(created.statusCode).toBe(201);
    const duplicate = await app.inject({ method: "POST", url: "/api/v1/talent-categories", payload: { name: "数据" } });
    expect(duplicate.statusCode).toBe(409);
  });

  it("creates records and rejects invalid payloads", async () => {
    expect((await app.inject({ method: "POST", url: "/api/v1/leads", payload: { subject: "缺字段" } })).statusCode).toBe(400);
    const lead = await app.inject({ method: "POST", url: "/api/v1/leads", payload: { subject: "新机会", company: "示例公司", owner: "负责人", score: 60, summary: "待联系", stage: "new" } });
    expect(lead.statusCode).toBe(201);
    expect((await app.inject({ method: "GET", url: `/api/v1/leads/${lead.json().item.id}` })).json().subject).toBe("新机会");
    const research = await app.inject({ method: "POST", url: "/api/v1/research-tasks", payload: { name: "岗位摸排", owner: "负责人", target: "示例公司", summary: "人才地图" } });
    expect(research.statusCode).toBe(201);
    expect(research.json().item).toMatchObject({ deadline: null, status: "todo", progress: 0 });
    expect((await app.inject({ method: "POST", url: "/api/v1/outreach", payload: { name: "邮件触达", channel: "email", summary: "第一批", targetCount: 2, touched: 1, replies: 2 } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/api/v1/outreach", payload: { name: "邮件触达", channel: "email", summary: "第一批", targetCount: 1, touched: 2, replies: 1 } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/api/v1/outreach", payload: { name: "邮件触达", channel: "email", summary: "第一批", targetCount: 4, touched: 2, replies: 1 } })).statusCode).toBe(201);
    expect((await app.inject({ method: "PATCH", url: "/api/v1/outreach/campaign-1", payload: { targetCount: 1 } })).statusCode).toBe(400);
  });

  it("reports partial batch results and validates duplicate ids", async () => {
    expect((await app.inject({ method: "POST", url: "/api/v1/leads/batch", payload: { ids: ["lead-1", "lead-1"], patch: { stage: "won" } } })).statusCode).toBe(400);
    const result = await app.inject({ method: "POST", url: "/api/v1/leads/batch", payload: { ids: ["lead-1", "missing"], patch: { stage: "won" } } });
    expect(result.json()).toMatchObject({ succeeded: 1, failed: 1, results: [{ id: "lead-1", success: true }, { id: "missing", success: false }] });
    expect((await app.inject({ method: "GET", url: "/api/v1/leads/lead-1" })).json().stage).toBe("won");
  });

  it("updates category owners and round-trips mapping JSON", async () => {
    expect((await app.inject({ method: "PATCH", url: "/api/v1/talent-categories/missing", payload: { owner: "负责人" } })).statusCode).toBe(404);
    expect((await app.inject({ method: "PATCH", url: "/api/v1/talent-categories/%E6%8A%80%E6%9C%AF", payload: { owner: "负责人" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/v1/talent-categories" })).json().items).toContainEqual({ name: "技术", owner: "负责人", count: 2 });
    expect((await app.inject({ method: "POST", url: "/api/v1/mapping/import", payload: { items: [{ source: "无目标" }] } })).statusCode).toBe(400);
    const item = { source: "Example / Role", target: "P5", type: "role", confidence: 75, summary: "样本" };
    expect((await app.inject({ method: "POST", url: "/api/v1/mapping/import", payload: { items: [item] } })).json().imported).toBe(1);
    const exported = await app.inject({ method: "GET", url: "/api/v1/mapping/export" });
    expect(exported.statusCode).toBe(200);
    expect(exported.json().items).toContainEqual(item);
  });

  it("renames categories with talent references and rejects conflicts", async () => {
    expect((await app.inject({ method: "PATCH", url: "/api/v1/talent-categories/%E6%8A%80%E6%9C%AF", payload: { name: "产品" } })).statusCode).toBe(409);
    expect((await app.inject({ method: "PATCH", url: "/api/v1/talent-categories/%E6%8A%80%E6%9C%AF", payload: { name: "研发" } })).statusCode).toBe(200);
    expect((await app.inject({ method: "GET", url: "/api/v1/talents/talent-2" })).json().category).toBe("研发");
    expect((await app.inject({ method: "PATCH", url: "/api/v1/talent-categories/%E6%9C%AA%E5%88%86%E7%B1%BB", payload: { name: "其他" } })).statusCode).toBe(400);
  });
});
