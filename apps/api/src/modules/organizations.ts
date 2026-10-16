import { createEvidenceRequestSchema, reviewEvidenceRequestSchema } from "@hr-console/contracts";
import type { FastifyInstance } from "fastify";
import type { PrismaClient } from "../generated/client/index.js";

function unitShape(unit: { id: string; companyId: string; parentId: string | null; name: string; kind: string; region: string | null; role: string | null; status: string; version: number; updatedAt: Date; _count: { children: number; evidences: number } }) {
  return { id: unit.id, companyId: unit.companyId, parentId: unit.parentId, name: unit.name, kind: unit.kind, region: unit.region, role: unit.role, status: unit.status, version: unit.version, childrenCount: unit._count.children, evidenceCount: unit._count.evidences, updatedAt: unit.updatedAt.toISOString() };
}

function evidenceShape(item: { id: string; organizationUnitId: string; title: string; excerpt: string; collectedAt: Date; confidence: number; status: string; reviewNote: string | null; reviewedAt: Date | null; source: { id: string; name: string; url: string | null } }) {
  return { id: item.id, organizationUnitId: item.organizationUnitId, title: item.title, excerpt: item.excerpt, collectedAt: item.collectedAt.toISOString(), confidence: item.confidence, status: item.status, reviewNote: item.reviewNote, reviewedAt: item.reviewedAt?.toISOString() ?? null, source: item.source };
}

export function organizationRoutes(app: FastifyInstance, db: PrismaClient): void {
  app.get<{ Querystring: { companyId?: string; parentId?: string; status?: string; page?: string; pageSize?: string } }>("/api/v1/organizations", async (request) => {
    const page = Math.max(1, Number(request.query.page ?? 1));
    const pageSize = Math.min(100, Math.max(1, Number(request.query.pageSize ?? 20)));
    const where = { ...(request.query.companyId ? { companyId: request.query.companyId } : {}), ...(request.query.parentId ? { parentId: request.query.parentId } : {}), ...(request.query.status ? { status: request.query.status } : {}) };
    const [items, total] = await Promise.all([
      db.organizationUnit.findMany({ where, include: { _count: { select: { children: true, evidences: true } } }, orderBy: [{ name: "asc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      db.organizationUnit.count({ where })
    ]);
    return { items: items.map(unitShape), total, page, pageSize, requestId: request.id };
  });

  app.get<{ Params: { id: string } }>("/api/v1/organizations/:id", async (request, reply) => {
    const item = await db.organizationUnit.findUnique({ where: { id: request.params.id }, include: { _count: { select: { children: true, evidences: true } }, children: { include: { _count: { select: { children: true, evidences: true } } }, orderBy: { name: "asc" } }, evidences: { include: { source: true }, orderBy: { collectedAt: "desc" } } } });
    if (!item) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "组织节点不存在", requestId: request.id } });
    return { ...unitShape(item), children: item.children.map(unitShape), evidence: item.evidences.map(evidenceShape), requestId: request.id };
  });

  app.post<{ Params: { id: string }; Body: unknown }>("/api/v1/organizations/:id/evidence", async (request, reply) => {
    const input = createEvidenceRequestSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "证据参数无效", details: input.error.issues, requestId: request.id } });
    const unit = await db.organizationUnit.findUnique({ where: { id: request.params.id } });
    if (!unit) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "组织节点不存在", requestId: request.id } });
    const source = await db.source.findUnique({ where: { id: input.data.sourceId } });
    if (!source) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "来源不存在", requestId: request.id } });
    const item = await db.evidence.create({ data: { organizationUnitId: unit.id, sourceId: source.id, title: input.data.title, excerpt: input.data.excerpt, collectedAt: new Date(input.data.collectedAt), confidence: input.data.confidence }, include: { source: true } });
    return reply.code(201).send({ item: evidenceShape(item), requestId: request.id });
  });

  app.patch<{ Params: { evidenceId: string }; Body: unknown }>("/api/v1/organizations/evidence/:evidenceId", async (request, reply) => {
    const input = reviewEvidenceRequestSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "审核参数无效", details: input.error.issues, requestId: request.id } });
    const existing = await db.evidence.findUnique({ where: { id: request.params.evidenceId } });
    if (!existing) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "证据不存在", requestId: request.id } });
    const item = await db.evidence.update({ where: { id: existing.id }, data: { status: input.data.status, reviewNote: input.data.reviewNote ?? null, reviewedAt: new Date() }, include: { source: true } });
    return { item: evidenceShape(item), requestId: request.id };
  });
}
