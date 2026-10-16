import { briefingUpdateSchema, briefingListQuerySchema } from "@hr-console/contracts";
import type { Briefing, BriefingListQuery } from "@hr-console/contracts";
import type { FastifyPluginAsync } from "fastify";
import type { Prisma, PrismaClient } from "../generated/client/index.js";

export interface BriefingRepository {
  list(query: BriefingListQuery): Promise<{ items: Briefing[]; total: number }>;
  get(id: string): Promise<Briefing | null>;
  setRead(id: string, read: boolean): Promise<Briefing | null>;
  markAllRead(): Promise<void>;
}

export class PrismaBriefingRepository implements BriefingRepository {
  constructor(private readonly prisma: PrismaClient) {}
  async list(query: BriefingListQuery) {
    const where = { ...(query.read === undefined ? {} : { read: query.read }), intelligence: { is: {
      ...(query.q ? { OR: [{ title: { contains: query.q, mode: "insensitive" as const } }, { summary: { contains: query.q, mode: "insensitive" as const } }] } : {}),
      ...(query.topic ? { tags: { has: query.topic } } : {})
    } } };
    const [records, total] = await Promise.all([
      this.prisma.briefing.findMany({ where, include: { intelligence: { include: { source: true, company: true } } }, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (query.page - 1) * query.pageSize, take: query.pageSize }),
      this.prisma.briefing.count({ where })
    ]);
    return { items: records.map(toBriefing), total };
  }
  async get(id: string) {
    const record = await this.prisma.briefing.findUnique({ where: { id }, include: { intelligence: { include: { source: true, company: true } } } });
    return record ? toBriefing(record) : null;
  }
  async setRead(id: string, read: boolean) {
    const result = await this.prisma.briefing.updateMany({ where: { id }, data: { read } });
    if (!result.count) return null;
    const record = await this.prisma.briefing.findUnique({ where: { id }, include: { intelligence: { include: { source: true, company: true } } } });
    return record ? toBriefing(record) : null;
  }
  async markAllRead() { await this.prisma.briefing.updateMany({ where: { read: false }, data: { read: true } }); }
}

type BriefingRecord = Prisma.BriefingGetPayload<{ include: { intelligence: { include: { source: true; company: true } } } }>;
function toBriefing(record: BriefingRecord): Briefing {
  const item = record.intelligence;
  return { id: record.id, read: record.read, confidence: record.confidence, updatedAt: record.updatedAt.toISOString(), intelligence: {
    id: item.id, title: item.title, summary: item.summary, content: item.content, kind: item.kind,
    companyName: item.company?.name ?? null, source: { id: item.source.id, name: item.source.name, url: item.source.url },
    importance: item.importance, tags: item.tags, publishedAt: item.publishedAt.toISOString(),
    createdAt: item.createdAt.toISOString(), updatedAt: item.updatedAt.toISOString()
  } };
}

export class BriefingService {
  constructor(private readonly repository: BriefingRepository) {}
  list(query: BriefingListQuery) { return this.repository.list(query); }
  get(id: string) { return this.repository.get(id); }
  setRead(id: string, read: boolean) { return this.repository.setRead(id, read); }
  markAllRead() { return this.repository.markAllRead(); }
}

export const briefingRoutes: FastifyPluginAsync<{ repository: BriefingRepository }> = async (app, { repository }) => {
  const service = new BriefingService(repository);
  app.get<{ Querystring: Record<string, string | undefined> }>("/api/v1/briefings", async (request, reply) => {
    const parsed = briefingListQuerySchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "查询参数无效", requestId: request.id } });
    const result = await service.list(parsed.data);
    return { ...result, page: parsed.data.page, pageSize: parsed.data.pageSize, requestId: request.id };
  });
  app.get<{ Params: { id: string } }>("/api/v1/briefings/:id", async (request, reply) => {
    const item = await service.get(request.params.id);
    return item ?? reply.code(404).send({ error: { code: "NOT_FOUND", message: "快讯不存在", requestId: request.id } });
  });
  app.patch<{ Params: { id: string }; Body: unknown }>("/api/v1/briefings/:id", async (request, reply) => {
    const input = briefingUpdateSchema.safeParse(request.body);
    if (!input.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "更新参数无效", requestId: request.id } });
    const item = await service.setRead(request.params.id, input.data.read);
    if (!item) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "快讯不存在", requestId: request.id } });
    return { item, requestId: request.id };
  });
  app.post("/api/v1/briefings/read-all", async (request) => {
    await service.markAllRead();
    return { ok: true, requestId: request.id };
  });
};
