import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";

describe("compensation API", () => {
  beforeEach(() => vi.spyOn(prisma.compensationAssumption, "findMany").mockResolvedValue([]));
  afterEach(() => vi.restoreAllMocks());
  it("returns versioned assumptions and a shared calculation snapshot", async () => {
    const app = buildApp();
    const assumptions = await app.inject({ method: "GET", url: "/api/v1/compensation/assumptions" });
    expect(assumptions.statusCode).toBe(200);
    expect(assumptions.json().version).toBe("comp-2026.09.29-v1");

    const response = await app.inject({
      method: "POST",
      url: "/api/v1/compensation/calculate",
      payload: {
        mode: "compare",
        basis: "nominal",
        locations: ["beijing", "shanghai", "hong-kong"],
        currency: "CNY",
        monthlyGross: 30000,
        annualBonus: 60000
      }
    });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.calculationId).toMatch(/^calc-/);
    expect(body.results).toHaveLength(3);
    expect(body.results[0].candidateWaterfall).toHaveLength(4);
    expect(body.results[0].employerWaterfall.at(-1).label).toBe("企业总成本");
    expect(body.results[0].trend).toHaveLength(12);
    expect(prisma.compensationAssumption.findMany).toHaveBeenCalledTimes(1);
  });

  it("supports reverse calculation and rejects invalid comparison input", async () => {
    const app = buildApp();
    const reverse = await app.inject({
      method: "POST",
      url: "/api/v1/compensation/calculate",
      payload: { mode: "reverse", locations: ["beijing"], currency: "CNY", monthlyGross: 20000, annualBonus: 0 }
    });
    expect(reverse.statusCode).toBe(200);
    expect(reverse.json().results[0].grossAnnual).toBeGreaterThan(20000 * 12);

    const invalid = await app.inject({
      method: "POST",
      url: "/api/v1/compensation/calculate",
      payload: { mode: "compare", locations: ["beijing"], currency: "CNY", monthlyGross: 30000 }
    });
    expect(invalid.statusCode).toBe(400);
  });

  it("returns sample aggregates with an insufficient-sample warning", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/api/v1/compensation/samples?location=beijing&levelCode=P4" });
    expect(response.statusCode).toBe(200);
    const body = response.json();
    expect(body.snapshotId).toBe("comp-samples-2026-q3-v1");
    expect(body.aggregates[0].p50).toBe(529000);
    expect(body.aggregates[0].insufficient).toBe(true);
    expect(body.aggregates[0].warning).toContain("样本量不足");
  });

  it("filters samples by series and rejects unknown filters", async () => {
    const app = buildApp();
    const response = await app.inject({ method: "GET", url: "/api/v1/compensation/samples?series=T" });
    expect(response.statusCode).toBe(200);
    expect(response.json().samples.every((sample: { series: string }) => sample.series === "T")).toBe(true);

    const invalid = await app.inject({ method: "GET", url: "/api/v1/compensation/samples?series=bad" });
    expect(invalid.statusCode).toBe(400);
  });
});
