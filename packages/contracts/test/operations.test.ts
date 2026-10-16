import { describe, expect, it } from "vitest";

import {
  competitorListQuerySchema,
  competitorListResponseSchema,
  intelligenceItemSchema,
  intelligenceListQuerySchema
} from "../src/index.js";

const intelligenceItem = {
  id: "intel-1",
  title: "Northstar AI 扩建企业产品团队",
  summary: "公司正在扩大企业产品和销售团队。",
  content: "Northstar AI 发布了新的企业产品，并在多个地区招聘产品和销售岗位。",
  kind: "company",
  companyName: "Northstar AI",
  source: { id: "source-1", name: "示例科技日报", url: "https://news.example.com/story/1" },
  importance: "high",
  tags: ["招聘", "企业软件"],
  publishedAt: "2026-09-28T08:30:00.000Z",
  createdAt: "2026-09-28T08:35:00.000Z",
  updatedAt: "2026-09-28T08:35:00.000Z"
} as const;

describe("intelligence contracts", () => {
  it("applies safe list defaults and validates date ranges", () => {
    expect(intelligenceListQuerySchema.parse({}).pageSize).toBe(20);
    expect(intelligenceListQuerySchema.parse({ from: "2026-09-01", to: "2026-09-28" }).sort).toBe("publishedAt:desc");
    expect(intelligenceListQuerySchema.safeParse({ from: "2026-09-29", to: "2026-09-28" }).success).toBe(false);
    expect(intelligenceListQuerySchema.safeParse({ pageSize: 101 }).success).toBe(false);
  });

  it("requires a valid source, classification, importance and timestamps", () => {
    expect(intelligenceItemSchema.parse(intelligenceItem).kind).toBe("company");
    expect(intelligenceItemSchema.safeParse({ ...intelligenceItem, source: { id: "", name: "", url: "not a url" } }).success).toBe(false);
    expect(intelligenceItemSchema.safeParse({ ...intelligenceItem, importance: "urgent" }).success).toBe(false);
  });
});

describe("competitor contracts", () => {
  it("parses query-string monitor filters and applies list defaults", () => {
    expect(competitorListQuerySchema.parse({ monitored: "true" })).toMatchObject({
      monitored: true,
      page: 1,
      pageSize: 20,
      sort: "lastUpdatedAt:desc"
    });
    expect(competitorListQuerySchema.parse({ monitored: "false" }).monitored).toBe(false);
    expect(competitorListQuerySchema.safeParse({ monitored: "yes" }).success).toBe(false);
  });

  it("validates paged list response metadata and competitor fields", () => {
    const competitor = {
      id: "company-1",
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
    const response = { items: [competitor], total: 1, page: 1, pageSize: 20, requestId: "req_test" };

    expect(competitorListResponseSchema.parse(response).items).toHaveLength(1);
    expect(competitorListResponseSchema.safeParse({ ...response, pageSize: 0 }).success).toBe(false);
    expect(competitorListResponseSchema.safeParse({ ...response, items: [{ ...competitor, employeeCount: -1 }] }).success).toBe(false);
  });
});
