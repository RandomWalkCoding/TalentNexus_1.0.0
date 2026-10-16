import { briefingListResponseSchema, briefingSchema } from "@hr-console/contracts";
import type { Briefing, BriefingListQuery, IntelligenceItem } from "@hr-console/contracts";
import { getIntelligence } from "../intelligence/intelligence-api";

export async function getBriefings(query: BriefingListQuery, signal?: AbortSignal): Promise<{ items: Briefing[]; total: number; fallback: boolean }> {
  const params = new URLSearchParams(); Object.entries(query).forEach(([key, value]) => { if (value !== undefined) params.set(key, String(value)); });
  try {
    const response = await fetch(`/api/v1/briefings?${params}`, signal ? { signal } : {});
    if (!response.ok) throw new Error("快讯加载失败");
    const body = briefingListResponseSchema.parse(await response.json());
    return { items: body.items, total: body.total, fallback: false };
  } catch (error) {
    if (signal?.aborted) throw error;
    const intelligence = await getIntelligence({ page: 1, pageSize: 100, sort: "importance:desc", q: query.q }, signal);
    const items = intelligence.data.items.filter((item) => !query.topic || item.tags.includes(query.topic)).map((item: IntelligenceItem) => ({ id: `briefing-${item.id}`, intelligence: item, read: false, confidence: item.importance === "high" ? 90 : item.importance === "medium" ? 80 : 70, updatedAt: item.updatedAt }));
    const visible = query.read === true ? [] : items;
    return { items: visible.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: visible.length, fallback: true };
  }
}

export async function getBriefingDetail(id: string, signal?: AbortSignal): Promise<Briefing> {
  const response = await fetch(`/api/v1/briefings/${id}`, signal ? { signal } : {});
  if (!response.ok) throw new Error("快讯详情加载失败");
  return briefingSchema.parse(await response.json());
}

export async function setBriefingRead(id: string): Promise<Briefing> {
  const response = await fetch(`/api/v1/briefings/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ read: true }) });
  if (!response.ok) throw new Error("标记已读失败");
  return briefingSchema.parse((await response.json() as { item: unknown }).item);
}

export async function readAllBriefings(): Promise<void> {
  const response = await fetch("/api/v1/briefings/read-all", { method: "POST" });
  if (!response.ok) throw new Error("批量标记失败");
}
