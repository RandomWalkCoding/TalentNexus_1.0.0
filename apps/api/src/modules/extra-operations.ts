import {
  leadSchema,
  leadUpdateSchema,
  mappingItemSchema,
  mappingUpdateSchema,
  operationListQuerySchema,
  outreachCampaignSchema,
  outreachUpdateSchema,
  researchTaskSchema,
  researchTaskUpdateSchema,
  talentUpdateSchema,
  leadCreateSchema,
  researchTaskCreateSchema,
  outreachCreateSchema,
  talentCategorySchema,
  talentCategoryUpdateSchema,
  leadBatchSchema,
  mappingImportSchema,
  talentSchema
} from "@hr-console/contracts";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";
import type { WorkflowRepository } from "./workflow-repository.js";
import { WorkflowService } from "./workflow-service.js";

const resources = ["leads", "talents", "research-tasks", "outreach", "mapping"] as const;
const resourceSchema = z.enum(resources);

export const seed = {
  leads: [
    { id: "lead-1", subject: "Northstar AI 亚太产品负责人", company: "Northstar AI", source: "市场情报", lastTouchedAt: "2026-09-27", stage: "qualified" as const, owner: "Rachel", score: 91, summary: "已有明确团队扩张信号，适合优先建立联系。", updatedAt: "2026-09-28T08:30:00.000Z" },
    { id: "lead-2", subject: "Harbor Robotics 供应链负责人", company: "Harbor Robotics", source: "招聘观察", lastTouchedAt: "2026-09-26", stage: "contacted" as const, owner: "林予安", score: 78, summary: "已完成首次触达，等待对方确认沟通时间。", updatedAt: "2026-09-27T06:00:00.000Z" },
    { id: "lead-3", subject: "Fieldnote Health 商业化团队", company: "Fieldnote Health", source: "市场情报", lastTouchedAt: null, stage: "new" as const, owner: "Rachel", score: 64, summary: "来自市场情报的新增机会，需要补充联系人。", updatedAt: "2026-09-25T03:00:00.000Z" }
  ],
  talents: [
    { id: "talent-1", name: "林予安", title: "资深产品经理", company: "Northstar AI", location: "上海", category: "产品", tags: ["B2B", "AI", "国际化"], updatedAt: "2026-09-28T08:40:00.000Z" },
    { id: "talent-2", name: "周启明", title: "研发总监", company: "Harbor Robotics", location: "深圳", category: "技术", tags: ["机器人", "研发管理"], updatedAt: "2026-09-27T07:15:00.000Z" },
    { id: "talent-3", name: "陈嘉宁", title: "商业化负责人", company: "Fieldnote Health", location: "新加坡", category: "商业化", tags: ["市场进入", "医疗"], updatedAt: "2026-09-26T04:20:00.000Z" },
    { id: "talent-4", name: "沈亦舟", title: "算法工程师", company: "Northstar AI", location: "杭州", category: "技术", tags: ["推荐系统", "机器学习"], updatedAt: "2026-09-24T02:10:00.000Z" },
    { id: "talent-5", name: "许知远", title: "战略分析师", company: "Harbor Robotics", location: "北京", category: "未分类", tags: ["战略", "市场研究"], updatedAt: "2026-09-23T02:10:00.000Z" }
  ],
  "research-tasks": [
    { id: "task-1", name: "Northstar AI 亚太团队摸排", status: "in_progress" as const, progress: 68, owner: "Rachel", target: "Northstar AI", summary: "补齐区域负责人、产品和销售岗位地图。", updatedAt: "2026-09-28T08:00:00.000Z" },
    { id: "task-2", name: "华南机器人研发人才盘点", status: "todo" as const, progress: 25, owner: "林予安", target: "Harbor Robotics", summary: "从研发、供应链和质量岗位开始收集。", updatedAt: "2026-09-27T05:30:00.000Z" },
    { id: "task-3", name: "数字医疗商业化样本复核", status: "done" as const, progress: 100, owner: "Rachel", target: "Fieldnote Health", summary: "已完成样本复核并输出候选人清单。", updatedAt: "2026-09-25T09:10:00.000Z" }
  ],
  outreach: [
    { id: "campaign-1", name: "AI 产品人才专题", channel: "email" as const, status: "running" as const, targetCount: 45, touched: 32, replies: 4, summary: "面向 AI 产品和解决方案人才的定向触达。", updatedAt: "2026-09-28T08:10:00.000Z" },
    { id: "campaign-2", name: "华南机器人研发人才", channel: "linkedin" as const, status: "running" as const, targetCount: 60, touched: 46, replies: 7, summary: "围绕研发负责人和资深工程师的专项战役。", updatedAt: "2026-09-27T06:30:00.000Z" },
    { id: "campaign-3", name: "国际化商业化负责人", channel: "email" as const, status: "paused" as const, targetCount: 40, touched: 28, replies: 5, summary: "等待补充区域薪酬与岗位信息后继续。", updatedAt: "2026-09-25T02:20:00.000Z" }
  ],
  mapping: [
    { id: "mapping-1", source: "Northstar AI / Product Lead", target: "P5 · 资深专家", type: "level" as const, confidence: 92, summary: "依据职责范围、汇报层级和团队规模匹配。", updatedAt: "2026-09-28T07:40:00.000Z" },
    { id: "mapping-2", source: "Harbor Robotics / Robotics Engineer", target: "T3 · 高级工程师", type: "role" as const, confidence: 86, summary: "技术深度与交付责任对应 T3 职级。", updatedAt: "2026-09-27T04:20:00.000Z" },
    { id: "mapping-3", source: "Fieldnote Health", target: "数字医疗", type: "company" as const, confidence: 97, summary: "公司行业与业务方向已完成归类。", updatedAt: "2026-09-24T03:30:00.000Z" }
  ]
};

const schemas = { leads: leadSchema, talents: talentSchema, "research-tasks": researchTaskSchema, outreach: outreachCampaignSchema, mapping: mappingItemSchema };
const updates = { leads: leadUpdateSchema, talents: talentUpdateSchema, "research-tasks": researchTaskUpdateSchema, outreach: outreachUpdateSchema, mapping: mappingUpdateSchema };

function error(reply: FastifyReply, requestId: string, message: string, status = 400) {
  return reply.code(status).send({ error: { code: status === 404 ? "NOT_FOUND" : "VALIDATION_ERROR", message, requestId } });
}

export const extraOperationsRoutes: FastifyPluginAsync<{ repository: WorkflowRepository }> = async (app, { repository }) => {
  const service = new WorkflowService(repository);
  app.get("/api/v1/talent-categories", async (request) => ({ items: await service.categoryDetails(), requestId: request.id }));
  app.patch<{ Params: { name: string }; Body: unknown }>("/api/v1/talent-categories/:name", async (request, reply) => {
    const input = talentCategoryUpdateSchema.safeParse(request.body);
    if (!input.success || request.params.name === "未分类" && input.data.name && input.data.name !== "未分类") return error(reply, request.id, "分类参数无效");
    const patch = { ...(input.data.name ? { name: input.data.name } : {}), ...(input.data.owner ? { owner: input.data.owner } : {}) };
    const result = await service.updateCategory(request.params.name, patch);
    if (result === "not-found") return error(reply, request.id, "分类不存在", 404);
    if (result === "conflict") return reply.code(409).send({ error: { code: "CONFLICT", message: "分类名称已存在", requestId: request.id } });
    return { ok: true, requestId: request.id };
  });
  app.post<{ Body: unknown }>("/api/v1/leads/batch", async (request, reply) => {
    const input = leadBatchSchema.safeParse(request.body);
    if (!input.success) return error(reply, request.id, "批量参数无效");
    return { ...await service.batchLeads(input.data.ids, input.data.patch), requestId: request.id };
  });
  app.post<{ Body: unknown }>("/api/v1/mapping/import", async (request, reply) => {
    const input = mappingImportSchema.safeParse(request.body);
    if (!input.success) return error(reply, request.id, "导入格式无效，最多 100 条");
    return reply.code(201).send({ imported: await service.importMapping(input.data), requestId: request.id });
  });
  app.get("/api/v1/mapping/export", async (request) => {
    const items = [];
    let page = 1;
    for (;;) {
      const result = await service.list("mapping", { page, pageSize: 100 });
      items.push(...result.items.map((item) => ({ source: item.source, target: item.target, type: item.type, confidence: item.confidence, summary: item.summary })));
      if (items.length >= result.total) break;
      page++;
    }
    return { items, requestId: request.id };
  });
  app.post<{ Body: unknown }>("/api/v1/talent-categories", async (request, reply) => {
    const input = talentCategorySchema.safeParse(request.body);
    if (!input.success) return error(reply, request.id, "分类名称无效");
    if (!(await service.createCategory(input.data.name))) return reply.code(409).send({ error: { code: "CONFLICT", message: "分类已存在", requestId: request.id } });
    return reply.code(201).send({ name: input.data.name });
  });
  app.post<{ Params: { resource: string }; Body: unknown }>("/api/v1/:resource", async (request, reply) => {
    const resource = resourceSchema.safeParse(request.params.resource);
    if (!resource.success || !["leads", "research-tasks", "outreach"].includes(resource.data)) return error(reply, request.id, "资源不支持创建", 404);
    const schemas = { leads: leadCreateSchema, "research-tasks": researchTaskCreateSchema, outreach: outreachCreateSchema } as const;
    const input = schemas[resource.data as keyof typeof schemas].safeParse(request.body);
    if (!input.success) return error(reply, request.id, "创建参数无效");
    const item = await service.create(resource.data, input.data);
    return reply.code(201).send({ ok: true, item, requestId: request.id });
  });
  app.get<{ Params: { resource: string }; Querystring: Record<string, string | undefined> }>("/api/v1/:resource", async (request, reply) => {
    const resource = resourceSchema.safeParse(request.params.resource);
    if (!resource.success) return error(reply, request.id, "资源不存在", 404);
    const query = operationListQuerySchema.safeParse(request.query);
    if (!query.success) return error(reply, request.id, "查询参数无效");
    const { page, pageSize } = query.data;
    const result = await service.list(resource.data, query.data);
    return { ...result, page, pageSize, requestId: request.id };
  });

  app.get<{ Params: { resource: string; id: string } }>("/api/v1/:resource/:id", async (request, reply) => {
    const resource = resourceSchema.safeParse(request.params.resource);
    if (!resource.success) return error(reply, request.id, "资源不存在", 404);
    const item = await service.get(resource.data, request.params.id);
    return item ?? error(reply, request.id, "记录不存在", 404);
  });

  app.patch<{ Params: { resource: string; id: string }; Body: unknown }>("/api/v1/:resource/:id", async (request, reply) => {
    const resource = resourceSchema.safeParse(request.params.resource);
    if (!resource.success) return error(reply, request.id, "资源不存在", 404);
    const input = updates[resource.data].safeParse(request.body);
    if (!input.success) return error(reply, request.id, "更新参数无效");
    const item = await service.get(resource.data, request.params.id);
    if (!item) return error(reply, request.id, "记录不存在", 404);
    const parsed = schemas[resource.data].safeParse({ ...item, ...input.data, updatedAt: new Date().toISOString() });
    if (!parsed.success) return error(reply, request.id, "更新参数不符合资源约束");
    if (resource.data === "outreach") {
      const campaign = outreachCampaignSchema.parse(parsed.data);
      if (campaign.replies > campaign.touched || campaign.touched > (campaign.targetCount ?? campaign.touched)) return error(reply, request.id, "目标人数、发送数和回复数应依次递减");
    }
    const result = await service.update(resource.data, item.id, input.data);
    if (result.status === "invalid-category") return error(reply, request.id, "分类不存在");
    if (result.status === "not-found") return error(reply, request.id, "记录不存在", 404);
    return { ok: true as const, item: result.item, requestId: request.id };
  });
};
