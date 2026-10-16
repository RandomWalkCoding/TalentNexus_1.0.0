import type { Briefing } from "@hr-console/contracts";
import { afterAll, describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";
import type { BriefingRepository } from "../src/modules/briefing.js";

const item: Briefing = {
  id: "briefing-1", read: false, updatedAt: "2026-09-28T08:30:00.000Z",
  intelligence: {
    id: "30000000-0000-4000-8000-000000000001", title: "市场信号", summary: "新增岗位", content: "详情",
    kind: "company", companyName: "Northstar AI", source: { id: "source-1", name: "日报", url: null },
    importance: "high", tags: [], publishedAt: "2026-09-28T08:00:00.000Z",
    createdAt: "2026-09-28T08:00:00.000Z", updatedAt: "2026-09-28T08:00:00.000Z"
  }
};
const repository: BriefingRepository = {
  async list() { return { items: [item], total: 1 }; },
  async get(id) { return id === item.id ? item : null; },
  async setRead(id, read) { return id === item.id ? { ...item, read } : null; },
  async markAllRead() { item.read = true; }
};
const app = buildApp({ briefingRepository: repository });
afterAll(async () => app.close());

describe("briefing endpoints", () => {
  it("lists, validates and persists read actions", async () => {
    expect((await app.inject({ method: "GET", url: "/api/v1/briefings?page=bad" })).statusCode).toBe(400);
    expect((await app.inject({ method: "GET", url: "/api/v1/briefings" })).json()).toMatchObject({ total: 1, items: [{ id: item.id }] });
    expect((await app.inject({ method: "PATCH", url: `/api/v1/briefings/${item.id}`, payload: { read: "yes" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PATCH", url: `/api/v1/briefings/${item.id}`, payload: { read: true } })).json().item.read).toBe(true);
    expect((await app.inject({ method: "PATCH", url: "/api/v1/briefings/missing", payload: { read: true } })).statusCode).toBe(404);
    expect((await app.inject({ method: "POST", url: "/api/v1/briefings/read-all" })).json().ok).toBe(true);
  });
});
