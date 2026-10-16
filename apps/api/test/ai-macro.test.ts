import { describe, expect, it } from "vitest";
import { buildApp } from "../src/app.js";

describe("stage 10 AI and macro routes", () => {
  it("reviews AI proposals with optimistic version checks", async () => {
    const app = buildApp();
    const list = await app.inject("/api/v1/ai/reviews");
    const review = list.json().items[0];
    const accepted = await app.inject({
      method: "PATCH", url: `/api/v1/ai/reviews/${review.id}`,
      payload: { expectedVersion: 1, status: "edited", edited: { ...review.proposed, role: "区域产品负责人" }, note: "已根据来源补充区域范围" }
    });
    expect(accepted.statusCode).toBe(200);
    const conflict = await app.inject({
      method: "PATCH", url: `/api/v1/ai/reviews/${review.id}`,
      payload: { expectedVersion: 1, status: "rejected", note: "重复确认" }
    });
    expect(conflict.statusCode).toBe(409);
    await app.close();
  });

  it("lists macro source freshness and rejects stale versions", async () => {
    const app = buildApp();
    const response = await app.inject("/api/v1/market-data/snapshots");
    expect(response.statusCode).toBe(200);
    expect(response.json().items.some((item: { stale: boolean }) => item.stale === false)).toBe(true);
    const snapshot = response.json().items[0];
    const published = await app.inject({
      method: "POST", url: `/api/v1/market-data/snapshots/${snapshot.id}/publish`,
      payload: { expectedVersion: "wrong", note: "版本校验" }
    });
    expect(published.statusCode).toBe(409);
    await app.close();
  });
});
