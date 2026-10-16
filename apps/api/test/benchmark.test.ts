import { afterEach, describe, expect, it, vi } from "vitest";
import { benchmarkFilterSchema, competitivenessInputSchema } from "@hr-console/contracts";
import { buildApp } from "../src/app.js";
import { prisma } from "../src/db/prisma.js";
import { demoActor } from "../src/modules/admin.js";
import { aggregateSamples, comparePlans, quantile } from "../src/modules/benchmark-service.js";
import { benchmarkSamples } from "../src/modules/benchmark-seed.js";
import { locations } from "../src/modules/compensation.js";

const input = competitivenessInputSchema.parse({ role: "产品经理", levelCode: "P4", plans: [
  { name: "A", location: "beijing", annualCash: 570000, employerBudget: 700000 },
  { name: "B", location: "singapore", annualCash: 160000 }
] });
const mapping = { id: "29100000-0000-4000-8000-000000000001", company: "Northstar AI", role: "产品经理", location: "beijing", series: "P", externalLevel: "Product 3", candidateLevels: ["P3", "P4"], confidence: 82, evidenceUrl: "https://jobs.example.com", rationale: "团队管理与职责证据", status: "pending", selectedLevel: null, version: 1, createdAt: new Date("2026-10-10"), updatedAt: new Date("2026-10-10"), reviews: [] };

afterEach(() => vi.restoreAllMocks());

describe("benchmark domain", () => {
  it("uses interpolated percentiles and keeps equity outside cash", () => {
    expect(quantile([100, 200, 300], .25)).toBe(150);
    const group = aggregateSamples(benchmarkSamples.slice(0, 3), "totalCash")[0]!;
    expect(group.p50).toBe(480000 * 1.19);
    expect(group.totalCash).toBe(group.p50);
    expect(group.employerCost).toBe(480000 * 1.66);
    expect(group.components.find(c => c.key === "equity")?.amount).toBe(120000);
  });
  it("never converts unknown equity to zero or publishes a sparse percentile", () => {
    const group = aggregateSamples(benchmarkSamples.slice(-1), "totalCash")[0]!;
    expect(group.insufficient).toBe(true);
    expect(group.p50).toBeNull();
    expect(group.employerCost).toBeNull();
    expect(group.missing).toContain("股权年化估值");
    const missingCash = aggregateSamples(benchmarkSamples.slice(0, 3).map((s, i) => i === 0 ? { ...s, bonusActual: null } : s), "totalCash")[0]!;
    expect(missingCash.eligibleCount).toBe(2);
    expect(missingCash.p75).toBeNull();
    expect(missingCash.totalCash).toBeNull();
  });
  it("separates role, currency and level cohorts", () => {
    const samples = [benchmarkSamples[0]!, { ...benchmarkSamples[1]!, role: "研发经理" }, { ...benchmarkSamples[2]!, currency: "USD" as const }];
    expect(aggregateSamples(samples, "totalCash")).toHaveLength(3);
  });
  it("cards, trend, budget inversion and target gap share the same amounts", () => {
    const report = comparePlans(input, benchmarkSamples, locations, "test", new Date("2026-10-14"));
    const a = report.results[0]!;
    expect(a.trend.at(-1)?.takeHome).toBe(a.takeHome);
    expect(a.trend.at(-1)?.employerCost).toBe(a.employerCost);
    expect(a.targetGap).toBe(1200);
    expect(a.budgetCash).toBe(553359.68);
    expect(a.nominalCny).toBe(a.annualCash);
    expect(report.results[1]!.nominalCny).toBe(856000);
    expect(report.results[1]!.purchasingPowerCny).toBe(736160);
  });
  it("withholds conclusions when macro snapshot is stale or cohort is missing", () => {
    const stale = comparePlans(input, benchmarkSamples, locations, "test", new Date("2026-11-01"));
    expect(stale.macroStale).toBe(true);
    expect(stale.results.every(r => r.position === null && r.targetGap === null && r.p50 === null)).toBe(true);
    const missing = comparePlans({ ...input, role: "未知岗位" }, benchmarkSamples, locations, "test", new Date("2026-10-14"));
    expect(missing.results.every(r => r.sampleCount === 0 && r.position === null)).toBe(true);
  });
});

describe("benchmark API", () => {
  it("queries the database, returns structure and persists its exact snapshot", async () => {
    const read = vi.spyOn(prisma.compensationSample, "findMany").mockResolvedValue(benchmarkSamples.slice(0, 3) as never);
    const save = vi.spyOn(prisma.benchmarkSnapshot, "create").mockResolvedValue({} as never);
    const app = buildApp();
    const response = await app.inject("/api/v1/compensation/structure?location=beijing&levelCode=P4&asOfDate=2026-10-14");
    expect(response.statusCode).toBe(200);
    expect(read).toHaveBeenCalledWith(expect.objectContaining({ where: expect.objectContaining({ location: "beijing", levelCode: "P4", sampleDate: { lte: "2026-10-14" } }) }));
    expect(save).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ id: response.json().snapshotId, payload: response.json() }) }));
    await app.close();
  });
  it("lists mappings and historical reviews", async () => {
    vi.spyOn(prisma.levelBenchmark, "findMany").mockResolvedValue([mapping] as never);
    const app = buildApp();
    const response = await app.inject("/api/v1/level-benchmarks");
    expect(response.statusCode).toBe(200);
    expect(response.json().items[0].candidateLevels).toEqual(["P3", "P4"]);
    await app.close();
  });
  it("confirms with optimistic locking and writes review in one transaction", async () => {
    vi.spyOn(prisma.levelBenchmark, "findUnique").mockResolvedValue(mapping as never);
    const update = vi.spyOn(prisma.levelBenchmark, "updateMany").mockResolvedValue({ count: 1 });
    const history = vi.spyOn(prisma.levelBenchmarkReview, "create").mockResolvedValue({} as never);
    vi.spyOn(prisma, "$transaction").mockImplementation((async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma)) as never);
    const app = buildApp();
    const response = await app.inject({ method: "PATCH", url: `/api/v1/level-benchmarks/${mapping.id}`, payload: { expectedVersion: 1, status: "confirmed", selectedLevel: "P4", note: "职责证据已核验" } });
    expect(response.statusCode).toBe(200);
    expect(update).toHaveBeenCalledWith(expect.objectContaining({ where: { id: mapping.id, version: 1 } }));
    expect(history).toHaveBeenCalledWith(expect.objectContaining({ data: expect.objectContaining({ actorId: demoActor.id, version: 2, selectedLevel: "P4" }) }));
    await app.close();
  });
  it("rejects concurrent review, missing evidence, invalid level and missing record", async () => {
    const find = vi.spyOn(prisma.levelBenchmark, "findUnique").mockResolvedValue(mapping as never);
    vi.spyOn(prisma.levelBenchmark, "updateMany").mockResolvedValue({ count: 0 });
    const history = vi.spyOn(prisma.levelBenchmarkReview, "create");
    vi.spyOn(prisma, "$transaction").mockImplementation((async (callback: (tx: typeof prisma) => Promise<unknown>) => callback(prisma)) as never);
    const app = buildApp();
    const review = { method: "PATCH" as const, url: `/api/v1/level-benchmarks/${mapping.id}`, payload: { expectedVersion: 1, status: "confirmed", selectedLevel: "P4", note: "职责证据已核验" } };
    expect((await app.inject(review)).statusCode).toBe(409);
    expect(history).not.toHaveBeenCalled();
    find.mockResolvedValue({ ...mapping, evidenceUrl: null } as never);
    expect((await app.inject(review)).statusCode).toBe(400);
    find.mockResolvedValue(mapping as never);
    expect((await app.inject({ ...review, payload: { ...review.payload, selectedLevel: "P9" } })).statusCode).toBe(400);
    find.mockResolvedValue(null);
    expect((await app.inject(review)).statusCode).toBe(404);
    await app.close();
  });
  it("calculates and stores a report, then retrieves the immutable payload", async () => {
    vi.spyOn(prisma.compensationSample, "findMany").mockResolvedValue(benchmarkSamples as never);
    vi.spyOn(prisma.compensationAssumption, "findMany").mockResolvedValue([]);
    vi.spyOn(prisma.benchmarkSnapshot, "create").mockResolvedValue({} as never);
    const app = buildApp({ identity: () => ({ ...demoActor, role: "manager" }) });
    const response = await app.inject({ method: "POST", url: "/api/v1/compensation/competitiveness", payload: input });
    expect(response.statusCode).toBe(200);
    const report = response.json();
    vi.spyOn(prisma.benchmarkSnapshot, "findUnique").mockResolvedValue({ id: report.snapshotId, kind: "competitiveness", actorId: demoActor.id, payload: report } as never);
    expect((await app.inject(`/api/v1/compensation/reports/${report.snapshotId}`)).json()).toEqual(report);
    await app.close();
  });
  it("validates all endpoints and rejects duplicate/negative plans", async () => {
    const app = buildApp();
    for (const url of ["/api/v1/compensation/structure?location=invalid", "/api/v1/level-benchmarks?asOfDate=invalid", "/api/v1/compensation/reports/invalid"]) expect((await app.inject(url)).statusCode).toBe(400);
    expect((await app.inject({ method: "PATCH", url: `/api/v1/level-benchmarks/${mapping.id}`, payload: {} })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/api/v1/compensation/competitiveness", payload: { ...input, plans: [input.plans[0], input.plans[0]] } })).statusCode).toBe(400);
    expect((await app.inject({ method: "POST", url: "/api/v1/compensation/competitiveness", payload: { ...input, plans: [{ ...input.plans[0], annualCash: -1 }, input.plans[1]] } })).statusCode).toBe(400);
    expect(benchmarkFilterSchema.safeParse({ asOfDate: "bad" }).success).toBe(false);
    await app.close();
  });
  it("requires login and mapping write permission", async () => {
    const anonymous = buildApp({ identity: () => null });
    for (const url of ["/api/v1/compensation/structure", "/api/v1/level-benchmarks", `/api/v1/compensation/reports/${mapping.id}`]) expect((await anonymous.inject(url)).statusCode).toBe(401);
    expect((await anonymous.inject({ method: "POST", url: "/api/v1/compensation/competitiveness", payload: input })).statusCode).toBe(401);
    await anonymous.close();
    const readonly = buildApp({ identity: () => ({ ...demoActor, role: "manager" }) });
    expect((await readonly.inject({ method: "PATCH", url: `/api/v1/level-benchmarks/${mapping.id}`, payload: {} })).statusCode).toBe(403);
    vi.spyOn(prisma.benchmarkSnapshot, "findUnique").mockResolvedValue({ actorId: "00000000-0000-4000-8000-000000000002" } as never);
    expect((await readonly.inject(`/api/v1/compensation/reports/${mapping.id}`)).statusCode).toBe(403);
    await readonly.close();
  });
  it("returns controlled errors when database dependencies fail", async () => {
    vi.spyOn(prisma.compensationSample, "findMany").mockRejectedValue(new Error("private connection string"));
    vi.spyOn(prisma.levelBenchmark, "findMany").mockRejectedValue(new Error("private connection string"));
    vi.spyOn(prisma.levelBenchmark, "findUnique").mockRejectedValue(new Error("private connection string"));
    vi.spyOn(prisma.benchmarkSnapshot, "findUnique").mockRejectedValue(new Error("private connection string"));
    const app = buildApp();
    for (const request of [
      { url: "/api/v1/compensation/structure" }, { url: "/api/v1/level-benchmarks" }, { url: `/api/v1/compensation/reports/${mapping.id}` },
      { method: "POST" as const, url: "/api/v1/compensation/competitiveness", payload: input },
      { method: "PATCH" as const, url: `/api/v1/level-benchmarks/${mapping.id}`, payload: { expectedVersion: 1, status: "rejected", note: "证据不足" } }
    ]) {
      const response = await app.inject(request);
      expect(response.statusCode).toBe(503);
      expect(response.body).not.toContain("private connection");
    }
    await app.close();
  });
});
