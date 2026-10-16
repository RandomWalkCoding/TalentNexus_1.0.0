import { describe, expect, it } from "vitest";

import {
  aiReviewDecisionSchema,
  aiTaskSchema,
  macroSnapshotPublishSchema,
  macroSnapshotSchema
} from "../src/index.js";

describe("stage 10 contracts", () => {
  it("requires edited content for edited AI decisions", () => {
    expect(aiReviewDecisionSchema.safeParse({
      expectedVersion: 1,
      status: "edited",
      note: "修正组织层级"
    }).success).toBe(false);
    expect(aiReviewDecisionSchema.parse({
      expectedVersion: 1,
      status: "edited",
      edited: { parentId: "unit-2" },
      note: "修正组织层级"
    }).status).toBe("edited");
  });

  it("keeps task attempts and terminal failure information explicit", () => {
    const task = aiTaskSchema.parse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      kind: "organization-analysis",
      status: "failed",
      inputRef: "organization:unit-1",
      model: "demo-model-v1",
      attempt: 2,
      maxAttempts: 3,
      errorCode: "TIMEOUT",
      errorMessage: "模型响应超时",
      createdAt: "2026-10-14T08:00:00.000Z",
      startedAt: "2026-10-14T08:00:01.000Z",
      finishedAt: "2026-10-14T08:00:30.000Z"
    });
    expect(task.attempt).toBe(2);
  });

  it("requires source and validity metadata for macro snapshots", () => {
    expect(macroSnapshotSchema.safeParse({
      id: "550e8400-e29b-41d4-a716-446655440000",
      metric: "ppp",
      source: "示例数据源",
      sourceUrl: "not-a-url",
      license: "demo",
      version: "ppp-2026-v1",
      publishedAt: "2026-10-14T08:00:00.000Z",
      validFrom: "2026-01-01",
      validUntil: "2026-12-31",
      status: "published",
      stale: false,
      observations: [{ key: "beijing", value: 1.2, unit: "factor", observedAt: "2026-01-01" }],
      checksum: "sha256:demo",
      supersedesId: null,
      createdAt: "2026-10-14T08:00:00.000Z"
    }).success).toBe(false);
    expect(macroSnapshotPublishSchema.safeParse({ expectedVersion: "", note: "发布" }).success).toBe(false);
  });
});
