import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { demoActor } from "../src/modules/admin.js";

describe("shell services", () => {
  afterEach(() => vi.restoreAllMocks());

  it("lists notifications and marks them all read", async () => {
    vi.spyOn(prisma.notification, "findMany").mockResolvedValue([{ id: "60000000-0000-4000-8000-000000000001", userId: demoActor.id, title: "更新", body: "有新信号", read: false, href: "/intelligence", createdAt: new Date("2026-10-05T08:00:00.000Z") }] as never);
    vi.spyOn(prisma.notification, "count").mockResolvedValue(1);
    const updateMany = vi.spyOn(prisma.notification, "updateMany").mockResolvedValue({ count: 1 });
    const app = buildApp({ identity: () => demoActor });
    try {
      const list = await app.inject("/api/v1/notifications");
      expect(list.statusCode).toBe(200);
      expect(list.json().unreadCount).toBe(1);
      expect((await app.inject({ method: "POST", url: "/api/v1/notifications/read-all" })).statusCode).toBe(200);
      expect(updateMany).toHaveBeenCalledWith({ where: { userId: demoActor.id, read: false }, data: { read: true } });
    } finally {
      await app.close();
    }
  });

  it("searches talents, companies and users", async () => {
    vi.spyOn(prisma.organizationUnit, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.leaderProfile, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.researchTask, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.searchProject, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.talent, "findMany").mockResolvedValue([{ id: "talent-1", name: "Rachel", title: "产品负责人", company: "TalentNexus", location: "北京", category: "产品", tags: [], updatedAt: new Date() }] as never);
    vi.spyOn(prisma.company, "findMany").mockResolvedValue([{ id: "company-1", name: "TalentNexus", industry: "AI", region: "北京", employeeCount: 10, createdAt: new Date(), updatedAt: new Date() }] as never);
    vi.spyOn(prisma.adminUser, "findMany").mockResolvedValue([{ id: demoActor.id, name: "Rachel", email: "rachel@talentnexus.local", role: "admin", status: "active", updatedAt: new Date() }] as never);
    const app = buildApp({ identity: () => demoActor });
    try {
      const response = await app.inject("/api/v1/search?q=Rachel");
      expect(response.statusCode).toBe(200);
      expect(response.json().items.map((item: { kind: string }) => item.kind)).toEqual(["talent", "company", "user"]);
    } finally {
      await app.close();
    }
  });

  it("reports PostgreSQL cloud storage status and protects it", async () => {
    vi.spyOn(prisma, "$queryRaw").mockResolvedValue([{ now: new Date("2026-10-05T08:00:00.000Z") }] as never);
    const app = buildApp({ identity: () => demoActor });
    try {
      const response = await app.inject("/api/v1/storage/status");
      expect(response.statusCode).toBe(200);
      expect(response.json().provider).toBe("postgresql");
      expect(response.json().connected).toBe(true);
      const unauthorized = buildApp({ identity: () => null });
      expect((await unauthorized.inject("/api/v1/storage/status")).statusCode).toBe(401);
      await unauthorized.close();
    } finally {
      await app.close();
    }
  });
});
