import type {
  Competitor,
  CompetitorDetailResponse,
  CompetitorListQuery,
  IntelligenceItem,
  IntelligenceListQuery,
  MonitorSignal
} from "@hr-console/contracts";
import type { Prisma, PrismaClient } from "../../generated/client/index.js";

import type { CompetitorPage, IntelligencePage, OperationsRepository } from "./repository.js";

const intelligenceIncludes = {
  source: true,
  company: true
} satisfies Prisma.IntelligenceItemInclude;

const competitorIncludes = {
  company: true,
  signals: { orderBy: { occurredAt: "desc" }, take: 50, include: { source: true } }
} satisfies Prisma.CompetitorMonitorInclude;

type IntelligenceRecord = Prisma.IntelligenceItemGetPayload<{ include: typeof intelligenceIncludes }>;
type CompetitorRecord = Prisma.CompetitorMonitorGetPayload<{ include: typeof competitorIncludes }>;

function toIntelligenceItem(item: IntelligenceRecord): IntelligenceItem {
  return {
    id: item.id,
    title: item.title,
    summary: item.summary,
    content: item.content,
    kind: item.kind,
    companyName: item.company?.name ?? null,
    source: { id: item.source.id, name: item.source.name, url: item.source.url },
    importance: item.importance,
    tags: item.tags,
    publishedAt: item.publishedAt.toISOString(),
    createdAt: item.createdAt.toISOString(),
    updatedAt: item.updatedAt.toISOString()
  };
}

function toMonitorSignal(signal: CompetitorRecord["signals"][number]): MonitorSignal {
  return {
    id: signal.id,
    kind: signal.kind,
    title: signal.title,
    summary: signal.summary,
    source: { id: signal.source.id, name: signal.source.name, url: signal.source.url },
    occurredAt: signal.occurredAt.toISOString()
  };
}

function toCompetitor(record: CompetitorRecord): Competitor {
  const latestFunding = record.signals.find((signal) => signal.kind === "funding");
  const latestHiring = record.signals.find((signal) => signal.kind === "hiring");
  return {
    id: record.id,
    name: record.company.name,
    industry: record.company.industry,
    region: record.company.region,
    employeeCount: record.company.employeeCount,
    monitored: record.monitored,
    fundingSignal: latestFunding?.summary ?? null,
    hiringSignal: latestHiring?.summary ?? null,
    lastUpdatedAt: record.lastUpdatedAt.toISOString(),
    createdAt: record.createdAt.toISOString(),
    updatedAt: record.updatedAt.toISOString()
  };
}

function intelligenceOrderBy(sort: IntelligenceListQuery["sort"]): Prisma.IntelligenceItemOrderByWithRelationInput[] {
  if (sort === "publishedAt:asc") return [{ publishedAt: "asc" }, { id: "asc" }];
  if (sort === "importance:desc") return [{ importance: "desc" }, { publishedAt: "desc" }, { id: "asc" }];
  return [{ publishedAt: "desc" }, { id: "asc" }];
}

function competitorOrderBy(sort: CompetitorListQuery["sort"]): Prisma.CompetitorMonitorOrderByWithRelationInput[] {
  if (sort === "name:asc") return [{ company: { name: "asc" } }, { id: "asc" }];
  if (sort === "employeeCount:desc") {
    return [{ company: { employeeCount: { sort: "desc", nulls: "last" } } }, { id: "asc" }];
  }
  return [{ lastUpdatedAt: "desc" }, { id: "asc" }];
}

export class PrismaOperationsRepository implements OperationsRepository {
  constructor(private readonly prisma: PrismaClient) {}

  async listIntelligence(query: IntelligenceListQuery): Promise<IntelligencePage> {
    const where: Prisma.IntelligenceItemWhereInput = {
      ...(query.kind ? { kind: query.kind } : {}),
      ...(query.sourceId ? { sourceId: query.sourceId } : {}),
      ...(query.source ? { source: { is: { name: { contains: query.source, mode: "insensitive" } } } } : {}),
      ...(query.importance ? { importance: query.importance } : {}),
      ...(query.from || query.to ? {
        publishedAt: {
          ...(query.from ? { gte: new Date(`${query.from}T00:00:00.000Z`) } : {}),
          ...(query.to ? { lte: new Date(`${query.to}T23:59:59.999Z`) } : {})
        }
      } : {}),
      ...(query.q ? {
        OR: [
          { title: { contains: query.q, mode: "insensitive" } },
          { summary: { contains: query.q, mode: "insensitive" } },
          { content: { contains: query.q, mode: "insensitive" } },
          { company: { is: { name: { contains: query.q, mode: "insensitive" } } } }
        ]
      } : {})
    };
    const [items, total] = await Promise.all([
      this.prisma.intelligenceItem.findMany({
        where,
        include: intelligenceIncludes,
        orderBy: intelligenceOrderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      this.prisma.intelligenceItem.count({ where })
    ]);
    return { items: items.map(toIntelligenceItem), total, page: query.page, pageSize: query.pageSize };
  }

  async getIntelligence(id: string): Promise<IntelligenceItem | null> {
    const item = await this.prisma.intelligenceItem.findUnique({ where: { id }, include: intelligenceIncludes });
    return item ? toIntelligenceItem(item) : null;
  }

  async listCompetitors(query: CompetitorListQuery): Promise<CompetitorPage> {
    const where: Prisma.CompetitorMonitorWhereInput = {
      ...(query.monitored === undefined ? {} : { monitored: query.monitored }),
      ...((query.industry || query.q) ? {
        AND: [
          ...(query.industry ? [{ company: { is: { industry: { contains: query.industry, mode: "insensitive" as const } } } }] : []),
          ...(query.q ? [{
            company: {
              is: {
                OR: [
                  { name: { contains: query.q, mode: "insensitive" as const } },
                  { industry: { contains: query.q, mode: "insensitive" as const } },
                  { region: { contains: query.q, mode: "insensitive" as const } }
                ]
              }
            }
          }] : [])
        ]
      } : {})
    };
    const [records, total] = await Promise.all([
      this.prisma.competitorMonitor.findMany({
        where,
        include: competitorIncludes,
        orderBy: competitorOrderBy(query.sort),
        skip: (query.page - 1) * query.pageSize,
        take: query.pageSize
      }),
      this.prisma.competitorMonitor.count({ where })
    ]);
    return { items: records.map(toCompetitor), total, page: query.page, pageSize: query.pageSize };
  }

  async getCompetitor(id: string): Promise<CompetitorDetailResponse | null> {
    const record = await this.prisma.competitorMonitor.findUnique({ where: { id }, include: competitorIncludes });
    return record ? { competitor: toCompetitor(record), signals: record.signals.map(toMonitorSignal) } : null;
  }

  async setCompetitorMonitoring(id: string, monitored: boolean): Promise<Competitor | null> {
    const updated = await this.prisma.competitorMonitor.updateMany({ where: { id }, data: { monitored } });
    if (updated.count === 0) return null;
    const record = await this.prisma.competitorMonitor.findUnique({ where: { id }, include: competitorIncludes });
    return record ? toCompetitor(record) : null;
  }
}
