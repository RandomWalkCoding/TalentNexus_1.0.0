import { competitorDetailResponseSchema, competitorListResponseSchema } from "@hr-console/contracts";
import type { CompetitorDetailResponse, CompetitorListQuery, CompetitorListResponse } from "@hr-console/contracts";

const now = "2026-09-28T08:00:00.000Z";
const fallback: CompetitorListResponse = { items: [
  { id: "demo-comp-1", name: "Northstar AI", industry: "生成式 AI", region: "美国 · 旧金山", employeeCount: 620, monitored: true, fundingSignal: "完成 B 轮融资，估值提升", hiringSignal: "新增 18 个产品与商业化岗位", lastUpdatedAt: now, createdAt: now, updatedAt: now },
  { id: "demo-comp-2", name: "Harbor Robotics", industry: "机器人", region: "中国 · 深圳", employeeCount: 410, monitored: true, fundingSignal: "新一轮融资完成", hiringSignal: "研发与供应链岗位持续增加", lastUpdatedAt: "2026-09-27T06:00:00.000Z", createdAt: now, updatedAt: now },
  { id: "demo-comp-3", name: "Fieldnote Health", industry: "数字医疗", region: "新加坡", employeeCount: 180, monitored: false, fundingSignal: null, hiringSignal: "进入两个新市场", lastUpdatedAt: "2026-09-24T03:00:00.000Z", createdAt: now, updatedAt: now }
], total: 3, page: 1, pageSize: 20, requestId: "demo" };
const signals: Record<string, CompetitorDetailResponse["signals"]> = {
  "demo-comp-1": [{ id: "sig-1", kind: "hiring", title: "扩大商业化团队", summary: "新增多个区域负责人和解决方案岗位。", source: { id: "s1", name: "公司招聘页", url: null }, occurredAt: now }],
  "demo-comp-2": [{ id: "sig-2", kind: "funding", title: "完成新一轮融资", summary: "资金将用于量产与供应链建设。", source: { id: "s2", name: "行业媒体", url: null }, occurredAt: "2026-09-27T06:00:00.000Z" }],
  "demo-comp-3": []
};

export async function getCompetitors(query: CompetitorListQuery, signal?: AbortSignal): Promise<{ data: CompetitorListResponse; fallback: boolean }> {
  const params = new URLSearchParams(); Object.entries(query).forEach(([key, value]) => { if (value !== undefined) params.set(key, String(value)); });
  try { const response = await fetch(`/api/v1/competitors?${params}`, signal ? { signal } : {}); if (!response.ok) throw new Error(); return { data: competitorListResponseSchema.parse(await response.json()), fallback: false }; }
  catch (error) {
    if (signal?.aborted) throw error;
    const items = fallback.items.filter((item) => (!query.q || `${item.name} ${item.industry} ${item.region}`.toLowerCase().includes(query.q.toLowerCase())) && (query.monitored === undefined || item.monitored === query.monitored) && (!query.industry || item.industry.toLowerCase().includes(query.industry.toLowerCase())))
      .sort((a, b) => query.sort === "name:asc" ? a.name.localeCompare(b.name) : query.sort === "employeeCount:desc" ? (b.employeeCount ?? -1) - (a.employeeCount ?? -1) : b.lastUpdatedAt.localeCompare(a.lastUpdatedAt));
    return { data: { ...fallback, items: items.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: items.length, page: query.page, pageSize: query.pageSize }, fallback: true };
  }
}

export async function getCompetitorDetail(id: string, signal?: AbortSignal): Promise<{ data: CompetitorDetailResponse; fallback: boolean }> {
  try { const response = await fetch(`/api/v1/competitors/${id}`, signal ? { signal } : {}); if (!response.ok) throw new Error(); return { data: competitorDetailResponseSchema.parse(await response.json()), fallback: false }; }
  catch (error) { if (signal?.aborted) throw error; const competitor = fallback.items.find((item) => item.id === id); if (!competitor) throw new Error("竞对详情加载失败"); return { data: { competitor, signals: signals[competitor.id] ?? [] }, fallback: true }; }
}

export async function updateMonitoring(id: string, monitored: boolean): Promise<void> {
  const response = await fetch(`/api/v1/competitors/${id}/monitor`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify({ monitored }) });
  if (!response.ok) throw new Error("监测状态更新失败");
}
