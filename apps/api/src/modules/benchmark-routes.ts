import {
  benchmarkFilterSchema, competitivenessInputSchema, competitivenessSchema, benchmarkStructureSchema,
  levelMappingReviewSchema, levelMappingsSchema, type CompensationLocation
} from "@hr-console/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import { z } from "zod";
import type { PrismaClient } from "../generated/client/index.js";
import type { Actor } from "./admin.js";
import { BenchmarkRepository } from "./benchmark-repository.js";
import { buildStructure, comparePlans } from "./benchmark-service.js";
import { locations } from "./compensation.js";

class ReviewConflict extends Error {}

export function benchmarkRoutes(app: FastifyInstance, db: PrismaClient, getActor: (request: FastifyRequest) => Actor | null) {
  const repository = new BenchmarkRepository(db);
  app.get("/api/v1/compensation/structure", async (request, reply) => {
    const parsed = benchmarkFilterSchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "筛选参数无效", requestId: request.id } });
    const samples = await repository.samples(parsed.data);
    const response = buildStructure(samples, parsed.data, request.id);
    await repository.saveSnapshot(response.snapshotId, "structure", response, getActor(request)!.id);
    return response;
  });

  app.get("/api/v1/level-benchmarks", async (request, reply) => {
    const parsed = benchmarkFilterSchema.safeParse(request.query);
    if (!parsed.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "筛选参数无效", requestId: request.id } });
    return levelMappingsSchema.parse({ items: await repository.mappings(parsed.data), requestId: request.id });
  });

  app.patch<{ Params: { id: string } }>("/api/v1/level-benchmarks/:id", async (request, reply) => {
    const parsed = levelMappingReviewSchema.safeParse(request.body);
    if (!parsed.success || !z.uuid().safeParse(request.params.id).success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "审核参数无效", requestId: request.id } });
    const record = await db.levelBenchmark.findUnique({ where: { id: request.params.id } });
    if (!record) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "职级映射不存在", requestId: request.id } });
    const data = parsed.data;
    if (data.status === "confirmed" && (!record.evidenceUrl || !record.candidateLevels.includes(data.selectedLevel!))) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "确认需要来源证据和候选职级", requestId: request.id } });
    try {
      await db.$transaction(async tx => {
        const changed = await tx.levelBenchmark.updateMany({ where: { id: record.id, version: data.expectedVersion },
          data: { status: data.status, selectedLevel: data.status === "confirmed" ? data.selectedLevel! : null, version: { increment: 1 } } });
        if (!changed.count) throw new ReviewConflict();
        await tx.levelBenchmarkReview.create({ data: { benchmarkId: record.id, version: data.expectedVersion + 1,
          status: data.status, selectedLevel: data.status === "confirmed" ? data.selectedLevel! : null, note: data.note, actorId: getActor(request)!.id } });
      });
    } catch (error) {
      if (error instanceof ReviewConflict) return reply.code(409).send({ error: { code: "CONFLICT", message: "记录已更新，请刷新后审核", requestId: request.id } });
      throw error;
    }
    return { ok: true, version: data.expectedVersion + 1 };
  });

  app.post("/api/v1/compensation/competitiveness", async (request, reply) => {
    const parsed = competitivenessInputSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "比较参数无效", requestId: request.id } });
    const filters = benchmarkFilterSchema.parse({ role: parsed.data.role, levelCode: parsed.data.levelCode, metric: parsed.data.metric, asOfDate: parsed.data.asOfDate });
    const [samples, rules] = await Promise.all([repository.samples(filters), db.compensationAssumption.findMany()]);
    // This version is tied to the fixed macro snapshot. Never silently combine arbitrary rule versions.
    const assumptions = { ...locations };
    for (const rule of rules) {
      if (rule.version !== "comp-2026.09.29-v1") continue;
      const key = rule.location as CompensationLocation;
      if (!assumptions[key]) continue;
      assumptions[key] = { ...assumptions[key], taxRate: Number(rule.taxRate), mandatoryRate: Number(rule.mandatoryRate), employerRate: Number(rule.employerRate) };
    }
    const report = comparePlans(parsed.data, samples, assumptions, request.id);
    await repository.saveSnapshot(report.snapshotId, "competitiveness", report, getActor(request)!.id);
    return report;
  });

  app.get<{ Params: { id: string } }>("/api/v1/compensation/reports/:id", async (request, reply) => {
    if (!z.uuid().safeParse(request.params.id).success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "快照号无效", requestId: request.id } });
    const record = await db.benchmarkSnapshot.findUnique({ where: { id: request.params.id } });
    if (!record) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "快照不存在", requestId: request.id } });
    const actor = getActor(request)!;
    if (actor.role !== "admin" && record.actorId !== actor.id) return reply.code(403).send({ error: { code: "PERMISSION_DENIED", message: "无权读取此快照", requestId: request.id } });
    return record.kind === "structure" ? benchmarkStructureSchema.parse(record.payload) : competitivenessSchema.parse(record.payload);
  });
}
