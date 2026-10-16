import {
  competitorDetailResponseSchema,
  competitorListResponseSchema,
  intelligenceItemSchema,
  intelligenceListResponseSchema,
  jobLevelsResponseSchema
} from "@hr-console/contracts";
import type { Competitor, CompetitorDetailResponse, IntelligenceItem } from "@hr-console/contracts";
import { afterAll, describe, expect, it } from "vitest";

import { buildApp } from "../src/app.js";
import type { OperationsRepository } from "../src/modules/operations/repository.js";

const intelligenceId = "30000000-0000-4000-8000-000000000001";
const competitorId = "40000000-0000-4000-8000-000000000001";

const intelligence: IntelligenceItem = {
  id: intelligenceId,
  title: "Northstar AI 扩建企业产品团队",
  summary: "公司正在扩大企业产品和销售团队。",
  content: "Northstar AI 发布了新的企业产品，并在多个地区招聘产品和销售岗位。",
  kind: "company",
  companyName: "Northstar AI",
  source: { id: "10000000-0000-4000-8000-000000000001", name: "示例科技日报", url: "https://news.example.com" },
  importance: "high",
  tags: ["招聘", "企业软件"],
  publishedAt: "2026-09-28T08:30:00.000Z",
  createdAt: "2026-09-28T08:35:00.000Z",
  updatedAt: "2026-09-28T08:35:00.000Z"
};

const competitor: Competitor = {
  id: competitorId,
  name: "Northstar AI",
  industry: "生成式 AI",
  region: "美国 · 旧金山",
  employeeCount: 680,
  monitored: true,
  fundingSignal: "完成新一轮融资",
  hiringSignal: "商业化岗位增长",
  lastUpdatedAt: "2026-09-28T08:30:00.000Z",
  createdAt: "2026-09-20T08:30:00.000Z",
  updatedAt: "2026-09-28T08:30:00.000Z"
};

const competitorDetail: CompetitorDetailResponse = {
  competitor,
  signals: [{
    id: "50000000-0000-4000-8000-000000000001",
    kind: "funding",
    title: "完成新一轮融资",
    summary: "公司宣布完成新一轮融资。",
    source: intelligence.source,
    occurredAt: "2026-09-28T08:30:00.000Z"
  }]
};

const repository: OperationsRepository = {
  async listIntelligence(query) {
    return { items: [intelligence], total: 1, page: query.page, pageSize: query.pageSize };
  },
  async getIntelligence(id) {
    return id === intelligenceId ? intelligence : null;
  },
  async listCompetitors(query) {
    return { items: [competitor], total: 1, page: query.page, pageSize: query.pageSize };
  },
  async getCompetitor(id) {
    return id === competitorId ? competitorDetail : null;
  },
  async setCompetitorMonitoring(id, monitored) {
    return id === competitorId ? { ...competitor, monitored } : null;
  }
};

const app = buildApp({ operationsRepository: repository });

afterAll(async () => {
  await app.close();
});

describe("intelligence endpoints", () => {
  it("returns a validated, paged list and a detail", async () => {
    const listResponse = await app.inject({ method: "GET", url: "/api/v1/intelligence?q=Northstar&page=2" });
    expect(listResponse.statusCode).toBe(200);
    expect(intelligenceListResponseSchema.parse(listResponse.json())).toMatchObject({ page: 2, pageSize: 20, total: 1 });

    const detailResponse = await app.inject({ method: "GET", url: `/api/v1/intelligence/${intelligenceId}` });
    expect(detailResponse.statusCode).toBe(200);
    expect(intelligenceItemSchema.parse(detailResponse.json()).id).toBe(intelligenceId);
  });

  it("rejects invalid filters and reports missing records", async () => {
    const invalid = await app.inject({ method: "GET", url: "/api/v1/intelligence?pageSize=101" });
    expect(invalid.statusCode).toBe(400);
    expect(invalid.json().error.code).toBe("VALIDATION_ERROR");

    const missing = await app.inject({ method: "GET", url: "/api/v1/intelligence/30000000-0000-4000-8000-000000000099" });
    expect(missing.statusCode).toBe(404);
    expect(missing.json().error.code).toBe("NOT_FOUND");
  });
});

describe("competitor endpoints", () => {
  it("returns validated list/detail responses and updates monitoring", async () => {
    const listResponse = await app.inject({ method: "GET", url: "/api/v1/competitors?monitored=true" });
    expect(listResponse.statusCode).toBe(200);
    expect(competitorListResponseSchema.parse(listResponse.json()).items[0]?.monitored).toBe(true);

    const detailResponse = await app.inject({ method: "GET", url: `/api/v1/competitors/${competitorId}` });
    expect(detailResponse.statusCode).toBe(200);
    expect(competitorDetailResponseSchema.parse(detailResponse.json()).signals).toHaveLength(1);

    const updateResponse = await app.inject({
      method: "PATCH",
      url: `/api/v1/competitors/${competitorId}/monitor`,
      payload: { monitored: false }
    });
    expect(updateResponse.statusCode).toBe(200);
    expect(updateResponse.json().ok).toBe(true);
  });

  it("validates monitor writes and returns not found for unknown monitors", async () => {
    const invalid = await app.inject({
      method: "PATCH",
      url: `/api/v1/competitors/${competitorId}/monitor`,
      payload: { monitored: "no" }
    });
    expect(invalid.statusCode).toBe(400);

    const missing = await app.inject({
      method: "PATCH",
      url: "/api/v1/competitors/40000000-0000-4000-8000-000000000099/monitor",
      payload: { monitored: false }
    });
    expect(missing.statusCode).toBe(404);
  });
});

describe("job level endpoints", () => {
  it("returns filtered levels and currency-converted benchmark samples", async () => {
    const response = await app.inject({ url: "/api/v1/job-levels?series=T&currency=CNY" });
    expect(response.statusCode).toBe(200);
    const result = jobLevelsResponseSchema.parse(response.json());
    expect(result.levels.length).toBeGreaterThan(0);
    expect(result.levels.every((level) => level.series === "T")).toBe(true);
    expect(result.benchmarks.every((item) => item.series === "T")).toBe(true);
    expect(result.currency).toBe("CNY");
    expect(result.benchmarks[0]?.salary).toBe(1495200);
  });

  it("rejects unsupported benchmark currencies", async () => {
    const response = await app.inject({ url: "/api/v1/job-levels?currency=EUR" });
    expect(response.statusCode).toBe(400);
    expect(response.json().error.code).toBe("VALIDATION_ERROR");
  });
});
