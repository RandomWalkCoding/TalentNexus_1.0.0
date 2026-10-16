import { intelligenceListResponseSchema, intelligenceItemSchema } from "@hr-console/contracts";
import type { IntelligenceItem, IntelligenceListQuery, IntelligenceListResponse } from "@hr-console/contracts";

const fallback: IntelligenceListResponse = {
  items: [
    { id: "demo-int-1", title: "生成式 AI 企业采购进入规模化阶段", summary: "多家企业扩大 AI 应用预算，产品与商业化团队同步扩张。", content: "企业客户的 AI 采购从试点走向规模化，重点关注产品落地与交付能力。", kind: "industry", companyName: null, source: { id: "demo-source-1", name: "TalentNexus 研究院", url: null }, importance: "high", tags: ["生成式 AI", "企业服务"], publishedAt: "2026-09-28T08:00:00.000Z", createdAt: "2026-09-28T08:00:00.000Z", updatedAt: "2026-09-28T08:00:00.000Z" },
    { id: "demo-int-2", title: "Northstar AI 启动亚太商业化招聘", summary: "公司新增多个区域负责人和解决方案岗位。", content: "Northstar AI 正在搭建亚太商业化团队，招聘重点覆盖新加坡、深圳和东京。", kind: "company", companyName: "Northstar AI", source: { id: "demo-source-2", name: "公司公告", url: null }, importance: "medium", tags: ["招聘", "亚太"], publishedAt: "2026-09-27T06:30:00.000Z", createdAt: "2026-09-27T06:30:00.000Z", updatedAt: "2026-09-27T06:30:00.000Z" },
    { id: "demo-int-3", title: "机器人行业供应链人才需求上升", summary: "融资与量产预期带动研发、供应链岗位增长。", content: "机器人企业在研发和供应链岗位上出现持续增量，华南地区信号最密集。", kind: "industry", companyName: null, source: { id: "demo-source-1", name: "TalentNexus 研究院", url: null }, importance: "low", tags: ["机器人", "供应链"], publishedAt: "2026-09-25T03:20:00.000Z", createdAt: "2026-09-25T03:20:00.000Z", updatedAt: "2026-09-25T03:20:00.000Z" }
  ], total: 3, page: 1, pageSize: 20, requestId: "demo"
};

export async function getIntelligence(query: IntelligenceListQuery, signal?: AbortSignal): Promise<{ data: IntelligenceListResponse; fallback: boolean }> {
  const params = new URLSearchParams();
  Object.entries(query).forEach(([key, value]) => { if (value !== undefined) params.set(key, String(value)); });
  try {
    const response = await fetch(`/api/v1/intelligence?${params}`, signal ? { signal } : {});
    if (!response.ok) throw new Error("request failed");
    return { data: intelligenceListResponseSchema.parse(await response.json()), fallback: false };
  } catch (error) {
    if (signal?.aborted) throw error;
    const q = query.q?.toLowerCase();
    const ranks = { high: 3, medium: 2, low: 1 };
    const items = fallback.items.filter((item) => (!q || `${item.title} ${item.summary} ${item.companyName ?? ""}`.toLowerCase().includes(q))
      && (!query.kind || item.kind === query.kind) && (!query.importance || item.importance === query.importance)
      && (!query.sourceId || item.source.id === query.sourceId) && (!query.source || item.source.name.toLowerCase().includes(query.source.toLowerCase()))
      && (!query.from || item.publishedAt.slice(0, 10) >= query.from) && (!query.to || item.publishedAt.slice(0, 10) <= query.to))
      .sort((a, b) => query.sort === "importance:desc" ? ranks[b.importance] - ranks[a.importance] || b.publishedAt.localeCompare(a.publishedAt) : query.sort === "publishedAt:asc" ? a.publishedAt.localeCompare(b.publishedAt) : b.publishedAt.localeCompare(a.publishedAt));
    return { data: { ...fallback, items: items.slice((query.page - 1) * query.pageSize, query.page * query.pageSize), total: items.length, page: query.page, pageSize: query.pageSize }, fallback: true };
  }
}

export async function getIntelligenceDetail(id: string, signal?: AbortSignal): Promise<{ data: IntelligenceItem; fallback: boolean }> {
  try {
    const response = await fetch(`/api/v1/intelligence/${id}`, signal ? { signal } : {});
    if (!response.ok) throw new Error("request failed");
    return { data: intelligenceItemSchema.parse(await response.json()), fallback: false };
  } catch (error) {
    if (signal?.aborted) throw error;
    const item = fallback.items.find((entry) => entry.id === id);
    if (!item) throw new Error("情报详情加载失败");
    return { data: item, fallback: true };
  }
}
