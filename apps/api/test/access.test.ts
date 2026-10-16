import { describe, expect, it, vi } from "vitest";
import { buildApp } from "../src/app.js";
import { demoActor } from "../src/modules/admin.js";

describe("resource access and audit", () => {
  it("rejects missing and disabled identities while keeping health public", async () => {
    for (const actor of [null, { ...demoActor, status: "disabled" as const }]) {
      const app = buildApp({ identity: () => actor });
      expect((await app.inject("/api/v1/dashboard")).statusCode).toBe(401);
      expect((await app.inject("/api/v1/health")).statusCode).toBe(200);
      await app.close();
    }
  });
  it("enforces manager read-only business access and denies admin access", async () => {
    const app = buildApp({ identity: () => ({ ...demoActor, role: "manager" }) });
    expect((await app.inject("/api/v1/dashboard")).statusCode).toBe(200);
    expect((await app.inject({ method: "HEAD", url: "/api/v1/dashboard" })).statusCode).toBe(200);
    for (const url of ["/api/v1/leads", "/api/v1/talents", "/api/v1/mapping", "/api/v1/admin/users"]) {
      const response = await app.inject({ method: "POST", url, payload: {} });
      expect(response.statusCode).toBe(403);
      expect(response.json().error.code).toBe("PERMISSION_DENIED");
    }
    expect((await app.inject("/api/v1/admin/roles")).statusCode).toBe(403);
    await app.close();
  });
  it("allows HR to inspect roles but denies administrative writes", async () => {
    const app = buildApp({ identity: () => ({ ...demoActor, role: "hr" }) });
    expect((await app.inject("/api/v1/admin/roles")).statusCode).toBe(200);
    expect((await app.inject({ method: "POST", url: "/api/v1/admin/users", payload: {} })).statusCode).toBe(403);
    await app.close();
  });
  it("audits successful writes with the affected ID and tolerates audit failure", async () => {
    const audit = vi.fn(async () => undefined);
    const app = buildApp({ identity: () => demoActor, audit });
    const response = await app.inject({ method: "POST", url: "/api/v1/dashboard/recommendations/northstar-ai/ignore" });
    expect(response.statusCode).toBe(200);
    expect(audit).toHaveBeenCalledWith(expect.objectContaining({ resource: "dashboard", resourceId: "northstar-ai", action: "post.dashboard", requestId: response.headers["x-request-id"] }));
    audit.mockRejectedValueOnce(new Error("audit unavailable"));
    expect((await app.inject("/api/v1/admin/roles")).statusCode).toBe(200);
    const calls = audit.mock.calls.length;
    expect((await app.inject({ method: "POST", url: "/api/v1/admin/users", payload: {} })).statusCode).toBe(400);
    expect(audit).toHaveBeenCalledTimes(calls);
    await app.close();
  });
});
