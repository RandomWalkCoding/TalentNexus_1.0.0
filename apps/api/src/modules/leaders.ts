import { createEvidenceRequestSchema, leaderCreateSchema, leaderUpdateSchema, reviewEvidenceRequestSchema } from "@hr-console/contracts";
import type { FastifyInstance } from "fastify";
import type { Prisma, PrismaClient } from "../generated/client/index.js";

function shape(item: { id: string; companyId: string; organizationUnitId: string | null; name: string; currentTitle: string | null; previousTitles: string[]; regions: string[]; teamSummary: string | null; contactChannels: string[]; status: string; version: number; updatedAt: Date; researchTasks: { researchTaskId: string }[] }) {
  return { id: item.id, companyId: item.companyId, organizationUnitId: item.organizationUnitId, name: item.name, currentTitle: item.currentTitle, previousTitles: item.previousTitles, regions: item.regions, teamSummary: item.teamSummary, contactChannels: item.contactChannels, status: item.status, version: item.version, researchTaskIds: item.researchTasks.map((task) => task.researchTaskId), updatedAt: item.updatedAt.toISOString() };
}

const include = { researchTasks: { select: { researchTaskId: true } } } as const;
const detailInclude = { ...include, evidences: { include: { source: { select: { id: true, name: true, url: true } } }, orderBy: { collectedAt: "desc" as const } } } as const;

function evidenceShape(item: { id: string; leaderId: string; title: string; excerpt: string; collectedAt: Date; confidence: number; status: string; source: { id: string; name: string; url: string | null } }) {
  return { id: item.id, leaderId: item.leaderId, title: item.title, excerpt: item.excerpt, collectedAt: item.collectedAt.toISOString(), confidence: item.confidence, status: item.status, source: item.source };
}

export function leaderRoutes(app: FastifyInstance, db: PrismaClient): void {
  app.get<{ Querystring: { companyId?: string; organizationUnitId?: string; q?: string; page?: string; pageSize?: string } }>("/api/v1/leaders", async (request) => {
    const page = Math.max(1, Number(request.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(request.query.pageSize ?? 20)));
    const q = request.query.q?.trim();
    const where = { ...(request.query.companyId ? { companyId: request.query.companyId } : {}), ...(request.query.organizationUnitId ? { organizationUnitId: request.query.organizationUnitId } : {}), ...(q ? { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { currentTitle: { contains: q, mode: "insensitive" as const } }] } : {}) };
    const [items, total] = await Promise.all([db.leaderProfile.findMany({ where, include, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }), db.leaderProfile.count({ where })]);
    return { items: items.map(shape), total, page, pageSize, requestId: request.id };
  });

  app.get<{ Params: { id: string } }>("/api/v1/leaders/:id", async (request, reply) => {
    const item = await db.leaderProfile.findUnique({ where: { id: request.params.id }, include: detailInclude });
    if (!item) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "领队档案不存在", requestId: request.id } });
    return { ...shape(item), evidence: item.evidences.map(evidenceShape), requestId: request.id };
  });

  app.post<{ Body: unknown }>("/api/v1/leaders", async (request, reply) => {
    const input = leaderCreateSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "领队参数无效", details: input.error.issues, requestId: request.id } });
    const company = await db.company.findUnique({ where: { id: input.data.companyId } });
    if (!company) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "公司不存在", requestId: request.id } });
    if (input.data.organizationUnitId && !(await db.organizationUnit.findUnique({ where: { id: input.data.organizationUnitId } }))) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "组织节点不存在", requestId: request.id } });
    const item = await db.leaderProfile.create({ data: input.data, include });
    return reply.code(201).send({ item: shape(item), requestId: request.id });
  });

  app.patch<{ Params: { id: string }; Body: unknown }>("/api/v1/leaders/:id", async (request, reply) => {
    const input = leaderUpdateSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "领队更新参数无效", details: input.error.issues, requestId: request.id } });
    try {
      const existing = await db.leaderProfile.findUnique({ where: { id: request.params.id } });
      if (!existing) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "领队档案不存在", requestId: request.id } });
      if (input.data.organizationUnitId) {
        const unit = await db.organizationUnit.findUnique({ where: { id: input.data.organizationUnitId } });
        if (!unit) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "组织节点不存在", requestId: request.id } });
        if (unit.companyId !== existing.companyId) return reply.code(409).send({ error: { code: "CONFLICT", message: "组织节点与领队不属于同一公司", requestId: request.id } });
      }
      const data: Prisma.LeaderProfileUpdateInput = {};
      if (input.data.organizationUnitId !== undefined) data.organizationUnit = input.data.organizationUnitId ? { connect: { id: input.data.organizationUnitId } } : { disconnect: true };
      if (input.data.name !== undefined) data.name = input.data.name;
      if (input.data.currentTitle !== undefined) data.currentTitle = input.data.currentTitle;
      if (input.data.previousTitles !== undefined) data.previousTitles = input.data.previousTitles;
      if (input.data.regions !== undefined) data.regions = input.data.regions;
      if (input.data.teamSummary !== undefined) data.teamSummary = input.data.teamSummary;
      if (input.data.contactChannels !== undefined) data.contactChannels = input.data.contactChannels;
      const item = await db.leaderProfile.update({ where: { id: request.params.id }, data, include });
      return { item: shape(item), requestId: request.id };
    } catch (error) {
      if ((error as { code?: string }).code === "P2025") return reply.code(404).send({ error: { code: "NOT_FOUND", message: "领队档案不存在", requestId: request.id } });
      throw error;
    }
  });

  app.post<{ Params: { taskId: string; leaderId: string } }>("/api/v1/research-tasks/:taskId/leaders/:leaderId", async (request, reply) => {
    const [task, leader] = await Promise.all([db.researchTask.findUnique({ where: { id: request.params.taskId } }), db.leaderProfile.findUnique({ where: { id: request.params.leaderId } })]);
    if (!task || !leader) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "摸排任务或领队不存在", requestId: request.id } });
    if (task.companyId && task.companyId !== leader.companyId) return reply.code(409).send({ error: { code: "CONFLICT", message: "任务与领队不属于同一公司", requestId: request.id } });
    await db.researchTaskLeader.upsert({ where: { researchTaskId_leaderId: { researchTaskId: task.id, leaderId: leader.id } }, create: { researchTaskId: task.id, leaderId: leader.id }, update: {} });
    return { ok: true, requestId: request.id };
  });

  app.post<{ Params: { id: string }; Body: unknown }>("/api/v1/leaders/:id/evidence", async (request, reply) => {
    const input = createEvidenceRequestSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "证据参数无效", details: input.error.issues, requestId: request.id } });
    const leader = await db.leaderProfile.findUnique({ where: { id: request.params.id } });
    if (!leader) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "领队档案不存在", requestId: request.id } });
    const source = await db.source.findUnique({ where: { id: input.data.sourceId } });
    if (!source) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "来源不存在", requestId: request.id } });
    const item = await db.leaderEvidence.create({ data: { leaderId: leader.id, sourceId: source.id, title: input.data.title, excerpt: input.data.excerpt, collectedAt: new Date(input.data.collectedAt), confidence: input.data.confidence }, include: { source: { select: { id: true, name: true, url: true } } } });
    return reply.code(201).send({ item: evidenceShape(item), requestId: request.id });
  });

  app.patch<{ Params: { evidenceId: string }; Body: unknown }>("/api/v1/leaders/evidence/:evidenceId", async (request, reply) => {
    const input = reviewEvidenceRequestSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "审核参数无效", details: input.error.issues, requestId: request.id } });
    const existing = await db.leaderEvidence.findUnique({ where: { id: request.params.evidenceId } });
    if (!existing) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "证据不存在", requestId: request.id } });
    const item = await db.leaderEvidence.update({ where: { id: existing.id }, data: { status: input.data.status }, include: { source: { select: { id: true, name: true, url: true } } } });
    return { item: evidenceShape(item), requestId: request.id };
  });
}
