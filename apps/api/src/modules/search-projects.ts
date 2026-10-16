import { searchProjectCandidateCreateSchema, searchProjectCandidateUpdateSchema, searchProjectCreateSchema, searchProjectUpdateSchema } from "@hr-console/contracts";
import type { FastifyInstance } from "fastify";
import type { Prisma, PrismaClient } from "../generated/client/index.js";

const candidateInclude = { talent: true } as const;
const detailInclude = { _count: { select: { candidates: true } }, candidates: { include: candidateInclude, orderBy: { createdAt: "asc" as const } } } as const;

function projectShape(item: { id: string; name: string; companyId: string | null; targetRole: string; regions: string[]; owner: string; status: string; targetCount: number; deadline: string | null; summary: string; updatedAt: Date; _count: { candidates: number } }) {
  return { id: item.id, name: item.name, companyId: item.companyId, targetRole: item.targetRole, regions: item.regions, owner: item.owner, status: item.status, targetCount: item.targetCount, deadline: item.deadline, summary: item.summary, candidateCount: item._count.candidates, updatedAt: item.updatedAt.toISOString() };
}

function candidateShape(item: { id: string; projectId: string; talentId: string; stage: string; source: string | null; nextActionAt: Date | null; feedback: string | null; talent: { id: string; name: string; title: string; company: string; location: string; category: string; tags: string[]; level: string; updatedAt: Date } }) {
  return { id: item.id, projectId: item.projectId, talentId: item.talentId, stage: item.stage, source: item.source, nextActionAt: item.nextActionAt?.toISOString() ?? null, feedback: item.feedback, talent: { ...item.talent, updatedAt: item.talent.updatedAt.toISOString() } };
}

function pageValue(value: string | undefined, fallback: number): number {
  const parsed = Number(value ?? fallback);
  return Number.isFinite(parsed) ? Math.max(1, Math.floor(parsed)) : fallback;
}

export function searchProjectRoutes(app: FastifyInstance, db: PrismaClient): void {
  app.get<{ Params: { talentId: string } }>("/api/v1/search-projects/candidates/:talentId/history", async (request) => {
    const items = await db.candidateProject.findMany({ where: { talentId: request.params.talentId }, include: { talent: true, project: { select: { id: true, name: true, status: true } } }, orderBy: { updatedAt: "desc" } });
    return { items: items.map((item) => ({ ...candidateShape(item), project: item.project })), total: items.length, requestId: request.id };
  });

  app.get<{ Querystring: { companyId?: string; status?: string; q?: string; page?: string; pageSize?: string } }>("/api/v1/search-projects", async (request) => {
    const page = pageValue(request.query.page, 1);
    const pageSize = Math.min(100, pageValue(request.query.pageSize, 20));
    const where: Prisma.SearchProjectWhereInput = {};
    if (request.query.companyId) where.companyId = request.query.companyId;
    if (request.query.status) where.status = request.query.status;
    const q = request.query.q?.trim();
    if (q) where.OR = [{ name: { contains: q, mode: "insensitive" } }, { targetRole: { contains: q, mode: "insensitive" } }, { owner: { contains: q, mode: "insensitive" } }];
    const [items, total] = await Promise.all([
      db.searchProject.findMany({ where, include: { _count: { select: { candidates: true } } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      db.searchProject.count({ where })
    ]);
    return { items: items.map(projectShape), total, page, pageSize, requestId: request.id };
  });

  app.get<{ Params: { id: string } }>("/api/v1/search-projects/:id", async (request, reply) => {
    const item = await db.searchProject.findUnique({ where: { id: request.params.id }, include: detailInclude });
    if (!item) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "寻访项目不存在", requestId: request.id } });
    return { ...projectShape(item), candidates: item.candidates.map(candidateShape), requestId: request.id };
  });

  app.post<{ Body: unknown }>("/api/v1/search-projects", async (request, reply) => {
    const input = searchProjectCreateSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "寻访项目参数无效", details: input.error.issues, requestId: request.id } });
    if (input.data.companyId && !(await db.company.findUnique({ where: { id: input.data.companyId } }))) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "目标公司不存在", requestId: request.id } });
    const { companyId, ...fields } = input.data;
    const data: Prisma.SearchProjectCreateInput = { ...fields, ...(companyId ? { company: { connect: { id: companyId } } } : {}) };
    const item = await db.searchProject.create({ data, include: { _count: { select: { candidates: true } } } });
    return reply.code(201).send({ item: projectShape(item), requestId: request.id });
  });

  app.patch<{ Params: { id: string }; Body: unknown }>("/api/v1/search-projects/:id", async (request, reply) => {
    const input = searchProjectUpdateSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "寻访项目更新参数无效", details: input.error.issues, requestId: request.id } });
    const existing = await db.searchProject.findUnique({ where: { id: request.params.id } });
    if (!existing) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "寻访项目不存在", requestId: request.id } });
    const data: Prisma.SearchProjectUpdateInput = {};
    if (input.data.targetRole !== undefined) data.targetRole = input.data.targetRole;
    if (input.data.regions !== undefined) data.regions = input.data.regions;
    if (input.data.owner !== undefined) data.owner = input.data.owner;
    if (input.data.status !== undefined) data.status = input.data.status;
    if (input.data.targetCount !== undefined) data.targetCount = input.data.targetCount;
    if (input.data.deadline !== undefined) data.deadline = input.data.deadline;
    if (input.data.summary !== undefined) data.summary = input.data.summary;
    const item = await db.searchProject.update({ where: { id: existing.id }, data, include: { _count: { select: { candidates: true } } } });
    return { item: projectShape(item), requestId: request.id };
  });

  app.post<{ Params: { id: string }; Body: unknown }>("/api/v1/search-projects/:id/candidates", async (request, reply) => {
    const input = searchProjectCandidateCreateSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "候选人参数无效", details: input.error.issues, requestId: request.id } });
    const [project, talent] = await Promise.all([db.searchProject.findUnique({ where: { id: request.params.id } }), db.talent.findUnique({ where: { id: input.data.talentId } })]);
    if (!project) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "寻访项目不存在", requestId: request.id } });
    if (!talent) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "人才档案不存在", requestId: request.id } });
    try {
      const item = await db.candidateProject.create({ data: { stage: input.data.stage, source: input.data.source, nextActionAt: input.data.nextActionAt ? new Date(input.data.nextActionAt) : null, feedback: input.data.feedback, project: { connect: { id: project.id } }, talent: { connect: { id: talent.id } } }, include: candidateInclude });
      return reply.code(201).send({ item: candidateShape(item), requestId: request.id });
    } catch (error) {
      if ((error as { code?: string }).code === "P2002") return reply.code(409).send({ error: { code: "CONFLICT", message: "候选人已在此项目中", requestId: request.id } });
      throw error;
    }
  });

  app.patch<{ Params: { id: string; candidateId: string }; Body: unknown }>("/api/v1/search-projects/:id/candidates/:candidateId", async (request, reply) => {
    const input = searchProjectCandidateUpdateSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "候选人更新参数无效", details: input.error.issues, requestId: request.id } });
    const existing = await db.candidateProject.findUnique({ where: { id: request.params.candidateId } });
    if (!existing || existing.projectId !== request.params.id) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "项目候选人不存在", requestId: request.id } });
    const data: Prisma.CandidateProjectUpdateInput = {};
    if (input.data.stage !== undefined) data.stage = input.data.stage;
    if (input.data.source !== undefined) data.source = input.data.source;
    if (input.data.nextActionAt !== undefined) data.nextActionAt = input.data.nextActionAt ? new Date(input.data.nextActionAt) : null;
    if (input.data.feedback !== undefined) data.feedback = input.data.feedback;
    const item = await db.candidateProject.update({ where: { id: existing.id }, data, include: candidateInclude });
    return { item: candidateShape(item), requestId: request.id };
  });
}
