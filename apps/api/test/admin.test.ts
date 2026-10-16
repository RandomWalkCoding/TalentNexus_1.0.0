import { afterEach, describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { demoActor, DEMO_USER_ID } from "../src/modules/admin.js";

const user = { ...demoActor, email: "rachel@example.test", passwordHash: null, updatedAt: new Date(), createdAt: new Date() };
describe("administration API", () => {
  afterEach(() => vi.restoreAllMocks());
  it("returns identity and persists partial preferences without overwriting defaults", async () => {
    vi.spyOn(prisma.adminUser, "findUnique").mockResolvedValue({ ...user, preference: null } as never);
    const upsert = vi.spyOn(prisma.userPreference, "upsert").mockResolvedValue({ userId: DEMO_USER_ID, theme: "light", density: "comfortable", notifications: true, defaultLocation: "beijing", defaultCurrency: "CNY", updatedAt: new Date() });
    const app = buildApp({ identity: () => demoActor });
    const me = await app.inject("/api/v1/me");
    expect(me.statusCode).toBe(200);
    expect(me.json().permissions).toContain("admin:write");
    expect(me.json().preferences.defaultCurrency).toBe("CNY");
    const response = await app.inject({ method: "PATCH", url: "/api/v1/me/preferences", payload: { theme: "light" } });
    expect(response.statusCode).toBe(200);
    expect(upsert).toHaveBeenCalledWith(expect.objectContaining({ update: { theme: "light" }, create: expect.objectContaining({ theme: "light", defaultCurrency: "CNY" }) }));
    expect((await app.inject({ method: "PATCH", url: "/api/v1/me/preferences", payload: {} })).statusCode).toBe(400);
    await app.close();
  });
  it("validates pagination and rejects invalid IDs and disabling the demo administrator", async () => {
    const app = buildApp({ identity: () => demoActor });
    for (const path of ["users", "dictionaries", "audit-logs"]) expect((await app.inject(`/api/v1/admin/${path}?pageSize=101`)).statusCode).toBe(400);
    expect((await app.inject({ method: "PATCH", url: "/api/v1/admin/users/invalid", payload: { role: "hr" } })).statusCode).toBe(400);
    expect((await app.inject({ method: "PATCH", url: `/api/v1/admin/users/${DEMO_USER_ID}`, payload: { status: "disabled" } })).statusCode).toBe(409);
    await app.close();
  });
  it("filters and paginates users and reports duplicate accounts", async () => {
    const findMany = vi.spyOn(prisma.adminUser, "findMany").mockResolvedValue([user]);
    vi.spyOn(prisma.adminUser, "count").mockResolvedValue(21);
    vi.spyOn(prisma.adminUser, "findUnique").mockResolvedValue(user);
    const app = buildApp({ identity: () => demoActor });
    const response = await app.inject("/api/v1/admin/users?page=2&role=admin&status=active&q=Rachel");
    expect(response.statusCode).toBe(200);
    expect(response.json().total).toBe(21);
    expect(findMany).toHaveBeenCalledWith(expect.objectContaining({ skip: 20, take: 20, where: expect.objectContaining({ role: "admin", status: "active" }) }));
    expect((await app.inject({ method: "POST", url: "/api/v1/admin/users", payload: { name: "Rachel", email: "rachel@example.test", role: "hr" } })).statusCode).toBe(409);
    await app.close();
  });
  it("creates users, edits dictionaries and serializes audit records", async () => {
    vi.spyOn(prisma.adminUser, "findUnique").mockResolvedValue(null);
    vi.spyOn(prisma.adminUser, "create").mockResolvedValue(user);
    vi.spyOn(prisma.dictionaryItem, "updateMany").mockResolvedValue({ count: 1 });
    vi.spyOn(prisma.auditLog, "findMany").mockResolvedValue([{ id: DEMO_USER_ID, actor: { name: "Rachel" }, action: "patch.admin", resource: "admin", resourceId: DEMO_USER_ID, requestId: "test", createdAt: new Date() }] as never);
    vi.spyOn(prisma.auditLog, "count").mockResolvedValue(1);
    const app = buildApp({ identity: () => demoActor });
    expect((await app.inject({ method: "POST", url: "/api/v1/admin/users", payload: { name: "Rachel", email: "new@example.test", role: "hr" } })).statusCode).toBe(201);
    expect((await app.inject({ method: "PATCH", url: `/api/v1/admin/dictionaries/${DEMO_USER_ID}`, payload: { enabled: false } })).statusCode).toBe(200);
    const logs = await app.inject("/api/v1/admin/audit-logs?action=patch.admin");
    expect(logs.statusCode).toBe(200);
    expect(logs.json().items[0].actorName).toBe("Rachel");
    await app.close();
  });
});
