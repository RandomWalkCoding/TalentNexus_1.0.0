import { healthResponseSchema } from "@hr-console/contracts";
import { afterAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";

const app = buildApp();

afterAll(async () => {
  await app.close();
});

describe("GET /api/v1/health", () => {
  it("returns the shared API health contract", async () => {
    const response = await app.inject({
      method: "GET",
      url: "/api/v1/health"
    });

    expect(response.statusCode).toBe(200);
    expect(response.headers["x-request-id"]).toBeTruthy();

    const body = healthResponseSchema.parse(response.json());
    expect(body.requestId).toBe(response.headers["x-request-id"]);
  });
});

describe("dashboard endpoints", () => {
  it("returns the shared dashboard contract and supports recommendation actions", async () => {
    const dashboardApp = buildApp();
    try {
      const initial = await dashboardApp.inject({ method: "GET", url: "/api/v1/dashboard" });
      expect(initial.statusCode).toBe(200);
      const dashboard = (await import("@hr-console/contracts")).dashboardResponseSchema.parse(initial.json());
      expect(dashboard.recommendations).toHaveLength(3);
      expect(dashboard.followups.length).toBeGreaterThan(0);

      const ignored = await dashboardApp.inject({ method: "POST", url: "/api/v1/dashboard/recommendations/northstar-ai/ignore" });
      expect(ignored.statusCode).toBe(200);
      const afterIgnore = await dashboardApp.inject({ method: "GET", url: "/api/v1/dashboard" });
      expect(afterIgnore.json().recommendations).toHaveLength(2);

      const restored = await dashboardApp.inject({ method: "POST", url: "/api/v1/dashboard/recommendations/northstar-ai/restore" });
      expect(restored.statusCode).toBe(200);

      const task = await dashboardApp.inject({ method: "POST", url: "/api/v1/dashboard/recommendations/northstar-ai/tasks" });
      expect(task.statusCode).toBe(200);
      expect(task.json().followup.company).toBe("Northstar AI");

      const missing = await dashboardApp.inject({ method: "POST", url: "/api/v1/dashboard/recommendations/unknown/ignore" });
      expect(missing.statusCode).toBe(404);
    } finally {
      await dashboardApp.close();
    }
  });
});
