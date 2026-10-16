import { leadSchema, mappingItemSchema, operationListResponseSchema, outreachCampaignSchema, researchTaskSchema, talentSchema, talentCategoryListSchema } from "@hr-console/contracts";
import type { Lead, MappingItem, OutreachCampaign, ResearchTask, Talent } from "@hr-console/contracts";

export type WorkflowResource = "leads" | "talents" | "research-tasks" | "outreach" | "mapping";
export type WorkflowItem = Lead | Talent | ResearchTask | OutreachCampaign | MappingItem;
export type WorkflowPatch = Record<string, unknown>;
const filterField: Record<WorkflowResource, keyof WorkflowItem | "stage" | "category" | "status" | "type"> = { leads: "stage", talents: "category", "research-tasks": "status", outreach: "status", mapping: "type" };
const searchable: Record<WorkflowResource, string[]> = { leads: ["subject", "company", "summary"], talents: ["name", "title", "company", "location", "tags"], "research-tasks": ["name", "owner", "target", "summary"], outreach: ["name", "channel", "summary"], mapping: ["source", "target", "summary"] };
const fallback: Record<WorkflowResource, WorkflowItem[]> = {
  leads: [
    { id: "lead-1", subject: "Northstar AI 亚太产品负责人", company: "Northstar AI", stage: "qualified", owner: "Rachel", score: 91, summary: "已有明确团队扩张信号，适合优先建立联系。", updatedAt: "2026-09-28T08:30:00.000Z" },
    { id: "lead-2", subject: "Harbor Robotics 供应链负责人", company: "Harbor Robotics", stage: "contacted", owner: "林予安", score: 78, summary: "已完成首次触达，等待对方确认沟通时间。", updatedAt: "2026-09-27T06:00:00.000Z" },
    { id: "lead-3", subject: "Fieldnote Health 商业化团队", company: "Fieldnote Health", stage: "new", owner: "Rachel", score: 64, summary: "来自市场情报的新增机会，需要补充联系人。", updatedAt: "2026-09-25T03:00:00.000Z" }
  ],
  talents: [
    { id: "talent-1", name: "林予安", title: "资深产品经理", company: "Northstar AI", location: "上海", category: "产品", tags: ["B2B", "AI", "国际化"], updatedAt: "2026-09-28T08:40:00.000Z" },
    { id: "talent-2", name: "周启明", title: "研发总监", company: "Harbor Robotics", location: "深圳", category: "技术", tags: ["机器人", "研发管理"], updatedAt: "2026-09-27T07:15:00.000Z" },
    { id: "talent-3", name: "陈嘉宁", title: "商业化负责人", company: "Fieldnote Health", location: "新加坡", category: "商业化", tags: ["市场进入", "医疗"], updatedAt: "2026-09-26T04:20:00.000Z" },
    { id: "talent-4", name: "沈亦舟", title: "算法工程师", company: "Northstar AI", location: "杭州", category: "技术", tags: ["推荐系统", "机器学习"], updatedAt: "2026-09-24T02:10:00.000Z" },
    { id: "talent-5", name: "许知远", title: "战略分析师", company: "Harbor Robotics", location: "北京", category: "未分类", tags: ["战略", "市场研究"], updatedAt: "2026-09-23T02:10:00.000Z" }
  ],
  "research-tasks": [
    { id: "task-1", name: "Northstar AI 亚太团队摸排", status: "in_progress", progress: 68, owner: "Rachel", target: "Northstar AI", summary: "补齐区域负责人、产品和销售岗位地图。", updatedAt: "2026-09-28T08:00:00.000Z" },
    { id: "task-2", name: "华南机器人研发人才盘点", status: "todo", progress: 25, owner: "林予安", target: "Harbor Robotics", summary: "从研发、供应链和质量岗位开始收集。", updatedAt: "2026-09-27T05:30:00.000Z" },
    { id: "task-3", name: "数字医疗商业化样本复核", status: "done", progress: 100, owner: "Rachel", target: "Fieldnote Health", summary: "已完成样本复核并输出候选人清单。", updatedAt: "2026-09-25T09:10:00.000Z" }
  ],
  outreach: [
    { id: "campaign-1", name: "AI 产品人才专题", channel: "email", status: "running", touched: 32, replies: 4, summary: "面向 AI 产品和解决方案人才的定向触达。", updatedAt: "2026-09-28T08:10:00.000Z" },
    { id: "campaign-2", name: "华南机器人研发人才", channel: "linkedin", status: "running", touched: 46, replies: 7, summary: "围绕研发负责人和资深工程师的专项战役。", updatedAt: "2026-09-27T06:30:00.000Z" },
    { id: "campaign-3", name: "国际化商业化负责人", channel: "email", status: "paused", touched: 28, replies: 5, summary: "等待补充区域薪酬与岗位信息后继续。", updatedAt: "2026-09-25T02:20:00.000Z" }
  ],
  mapping: [
    { id: "mapping-1", source: "Northstar AI / Product Lead", target: "P5 · 资深专家", type: "level", confidence: 92, summary: "依据职责范围、汇报层级和团队规模匹配。", updatedAt: "2026-09-28T07:40:00.000Z" },
    { id: "mapping-2", source: "Harbor Robotics / Robotics Engineer", target: "T3 · 高级工程师", type: "role", confidence: 86, summary: "技术深度与交付责任对应 T3 职级。", updatedAt: "2026-09-27T04:20:00.000Z" },
    { id: "mapping-3", source: "Fieldnote Health", target: "数字医疗", type: "company", confidence: 97, summary: "公司行业与业务方向已完成归类。", updatedAt: "2026-09-24T03:30:00.000Z" }
  ]
};

function parseItem(resource: WorkflowResource, value: unknown): WorkflowItem {
  if (resource === "leads") return leadSchema.parse(value);
  if (resource === "talents") return talentSchema.parse(value);
  if (resource === "research-tasks") return researchTaskSchema.parse(value);
  if (resource === "outreach") return outreachCampaignSchema.parse(value);
  return mappingItemSchema.parse(value);
}

export async function getWorkflow(resource: WorkflowResource, query: { q?: string | undefined; filter?: string | undefined; page?: number | undefined; pageSize?: number | undefined; location?: string | undefined; tag?: string | undefined; channel?: string | undefined }, signal?: AbortSignal): Promise<{ items: WorkflowItem[]; total: number; page: number; pageSize: number; fallback: boolean }> {
  const params = new URLSearchParams(); Object.entries(query).forEach(([key, value]) => { if (value !== undefined) params.set(key, String(value)); });
  try {
    const response = await fetch(`/api/v1/${resource}?${params}`, signal ? { signal } : {}); if (!response.ok) throw new Error();
    const body = operationListResponseSchema.parse(await response.json());
    return { items: body.items.map((item) => parseItem(resource, item)), total: body.total, page: body.page, pageSize: body.pageSize, fallback: false };
  } catch (error) {
    if (signal?.aborted) throw error;
    const q = query.q?.toLowerCase(); const filter = query.filter;
    const items = fallback[resource].filter((item) => {
      const record = item as unknown as Record<string, unknown>;
      const text = searchable[resource].filter((field) => field !== "tags").map((field) => record[field] ?? "").join(" ").toLowerCase();
      return (!q || text.includes(q) || resource === "talents" && (item as Talent).tags.includes(query.q!)) && (!filter || String(record[filterField[resource]]) === filter)
        && (!query.location || String(record.location).toLowerCase().includes(query.location.toLowerCase()))
        && (!query.tag || resource === "talents" && (item as Talent).tags.includes(query.tag))
        && (!query.channel || record.channel === query.channel);
    });
    const page = query.page ?? 1; const pageSize = query.pageSize ?? 20;
    return { items: items.slice((page - 1) * pageSize, page * pageSize), total: items.length, page, pageSize, fallback: true };
  }
}

export async function getWorkflowDetail(resource: WorkflowResource, id: string, signal?: AbortSignal): Promise<{ item: WorkflowItem; fallback: boolean }> {
  try { const response = await fetch(`/api/v1/${resource}/${id}`, signal ? { signal } : {}); if (!response.ok) throw new Error(); return { item: parseItem(resource, await response.json()), fallback: false }; }
  catch (error) {
    if (signal?.aborted) throw error;
    const item = fallback[resource].find((entry) => entry.id === id);
    if (!item) throw new Error("无法加载该记录的详情");
    return { item, fallback: true };
  }
}

export async function updateWorkflow(resource: WorkflowResource, id: string, patch: WorkflowPatch): Promise<WorkflowItem> {
  const response = await fetch(`/api/v1/${resource}/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(patch) });
  if (!response.ok) throw new Error("更新失败");
  const body = await response.json() as { item: unknown };
  return parseItem(resource, body.item);
}

export async function getTalentCategories(signal?: AbortSignal): Promise<string[]> {
  const response = await fetch("/api/v1/talent-categories", signal ? { signal } : {});
  if (!response.ok) throw new Error("分类加载失败");
  const body = talentCategoryListSchema.parse(await response.json());
  return body.items.map((item) => item.name);
}

export async function createWorkflow(resource: WorkflowResource, input: Record<string, unknown>) {
  const body = await write(`/api/v1/${resource}`, "POST", input) as { item: unknown };
  return parseItem(resource, body.item);
}

export async function write(url: string, method: "POST" | "PATCH", input: unknown): Promise<unknown> {
  const response = await fetch(url, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
  const body = await response.json() as { error?: { message?: string } };
  if (!response.ok) throw new Error(body.error?.message ?? "保存失败");
  return body;
}

export async function getCategoryDetails(signal?: AbortSignal) {
  const response = await fetch("/api/v1/talent-categories", signal ? { signal } : {});
  if (!response.ok) throw new Error("分类加载失败");
  return talentCategoryListSchema.parse(await response.json()).items;
}
