import { benchmarkSampleSchema, levelMappingSchema, type BenchmarkFilter } from "@hr-console/contracts";
import type { PrismaClient, Prisma } from "../generated/client/index.js";

export class BenchmarkRepository {
  constructor(private readonly db: PrismaClient) {}

  async samples(filters: BenchmarkFilter) {
    const where: Prisma.CompensationSampleWhereInput = { sampleDate: { lte: filters.asOfDate } };
    if (filters.company) where.company = filters.company;
    if (filters.role) where.role = filters.role;
    if (filters.location) where.location = filters.location;
    if (filters.levelCode) where.levelCode = filters.levelCode;
    if (filters.series) where.series = filters.series;
    const rows = await this.db.compensationSample.findMany({ where, orderBy: { id: "asc" } });
    return rows.map(row => benchmarkSampleSchema.parse({ ...row, period: "annual", taxBasis: "gross",
      base: Number(row.base), bonusTarget: row.bonusTarget === null ? null : Number(row.bonusTarget),
      bonusActual: row.bonusActual === null ? null : Number(row.bonusActual), equity: row.equity === null ? null : Number(row.equity),
      allowances: row.allowances === null ? null : Number(row.allowances), statutoryBenefits: row.statutoryBenefits === null ? null : Number(row.statutoryBenefits),
      extraBenefits: row.extraBenefits === null ? null : Number(row.extraBenefits), employerTaxes: row.employerTaxes === null ? null : Number(row.employerTaxes)
    }));
  }

  async mappings(filters: BenchmarkFilter) {
    const where: Prisma.LevelBenchmarkWhereInput = { createdAt: { lt: new Date(`${filters.asOfDate}T23:59:59.999Z`) } };
    if (filters.company) where.company = filters.company;
    if (filters.role) where.role = filters.role;
    if (filters.location) where.location = filters.location;
    if (filters.series) where.series = filters.series;
    if (filters.levelCode) where.candidateLevels = { has: filters.levelCode };
    const rows = await this.db.levelBenchmark.findMany({ where, include: { reviews: { orderBy: { version: "desc" } } }, orderBy: { updatedAt: "desc" }, take: 200 });
    return rows.map(row => levelMappingSchema.parse({ ...row, updatedAt: row.updatedAt.toISOString(),
      history: row.reviews.map(r => ({ ...r, createdAt: r.createdAt.toISOString() })) }));
  }

  async saveSnapshot(id: string, kind: string, payload: object, actorId: string) {
    await this.db.benchmarkSnapshot.create({ data: { id, kind, actorId, payload: JSON.parse(JSON.stringify(payload)) as Prisma.InputJsonValue } });
  }
}
