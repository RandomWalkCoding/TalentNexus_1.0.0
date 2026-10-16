import {
  aiReviewDecisionSchema,
  macroSnapshotPublishSchema,
  type AiReview,
  type AiTask,
  type MacroSnapshot
} from "@hr-console/contracts";
import type { FastifyInstance } from "fastify";
import { randomUUID } from "node:crypto";

const actorId = "00000000-0000-4000-8000-000000000001";
const now = "2026-10-14T08:00:00.000Z";

const tasks: AiTask[] = [{
  id: "30000000-0000-4000-8000-000000000001",
  kind: "organization-analysis",
  status: "succeeded",
  inputRef: "organization-unit:20000000-0000-4000-8000-000000000001",
  model: "demo-structured-v1",
  attempt: 1,
  maxAttempts: 3,
  errorCode: null,
  errorMessage: null,
  createdAt: now,
  startedAt: now,
  finishedAt: now
}];

const reviews: AiReview[] = [{
  id: "31000000-0000-4000-8000-000000000001",
  taskId: tasks[0]!.id,
  entityType: "organization-unit",
  entityId: "20000000-0000-4000-8000-000000000001",
  status: "pending",
  proposed: { name: "亚太产品与商业化", kind: "function", region: "上海", role: "产品负责人" },
  evidenceIds: [],
  reviewerId: null,
  reviewNote: null,
  reviewedAt: null,
  version: 1,
  createdAt: now
}];

const snapshots: MacroSnapshot[] = [{
  id: "32000000-0000-4000-8000-000000000001",
  metric: "exchange-rate",
  source: "TalentNexus Demo Feed",
  sourceUrl: "https://example.com/talentnexus/macro",
  license: "演示数据",
  version: "fx-2026-10-14",
  publishedAt: now,
  validFrom: "2026-10-01",
  validUntil: "2026-10-31",
  status: "published",
  stale: false,
  observations: [
    { key: "USD/CNY", value: 7.12, unit: "CNY per USD", observedAt: "2026-10-14" },
    { key: "SGD/CNY", value: 5.28, unit: "CNY per SGD", observedAt: "2026-10-14" }
  ],
  checksum: "demo-fx-20261014",
  supersedesId: null,
  createdAt: now
}, {
  id: "32000000-0000-4000-8000-000000000002",
  metric: "ppp",
  source: "TalentNexus Demo Feed",
  sourceUrl: "https://example.com/talentnexus/macro",
  license: "演示数据",
  version: "ppp-2026-10-14",
  publishedAt: now,
  validFrom: "2026-01-01",
  validUntil: "2026-12-31",
  status: "published",
  stale: false,
  observations: [
    { key: "beijing", value: 1, unit: "CNY index", observedAt: "2026-10-14" },
    { key: "singapore", value: 0.86, unit: "CNY index", observedAt: "2026-10-14" }
  ],
  checksum: "demo-ppp-20261014",
  supersedesId: null,
  createdAt: now
}];

function stale(snapshot: MacroSnapshot) {
  return Date.parse(snapshot.validUntil) < Date.now();
}

export function registerAiMacroRoutes(app: FastifyInstance) {
  app.get("/api/v1/ai/tasks", async (request) => ({
    items: tasks,
    total: tasks.length,
    requestId: request.id
  }));

  app.post<{ Body: unknown }>("/api/v1/ai/tasks", async (request, reply) => {
    const body = request.body as Record<string, unknown>;
    const kind = body?.kind === "intelligence-extraction" ? body.kind : body?.kind === "organization-analysis" ? body.kind : null;
    const inputRef = typeof body?.inputRef === "string" ? body.inputRef.trim() : "";
    if (!kind || !inputRef) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "AI 任务参数无效", requestId: request.id } });
    const task: AiTask = {
      id: randomUUID(), kind, inputRef, status: "queued", model: "demo-structured-v1",
      attempt: 0, maxAttempts: 3, errorCode: null, errorMessage: null,
      createdAt: new Date().toISOString(), startedAt: null, finishedAt: null
    };
    tasks.unshift(task);
    return reply.code(202).send({ item: task, requestId: request.id });
  });

  app.get("/api/v1/ai/reviews", async (request) => ({ items: reviews, requestId: request.id }));

  app.patch<{ Params: { id: string }; Body: unknown }>("/api/v1/ai/reviews/:id", async (request, reply) => {
    const parsed = aiReviewDecisionSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "审核参数无效", requestId: request.id } });
    const review = reviews.find((item) => item.id === request.params.id);
    if (!review) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "AI 审核记录不存在", requestId: request.id } });
    if (review.version !== parsed.data.expectedVersion) return reply.code(409).send({ error: { code: "VERSION_CONFLICT", message: "审核记录已被其他人更新", requestId: request.id } });
    review.status = parsed.data.status;
    review.proposed = parsed.data.edited ?? review.proposed;
    review.reviewNote = parsed.data.note;
    review.reviewerId = actorId;
    review.reviewedAt = new Date().toISOString();
    review.version += 1;
    return { item: review, requestId: request.id };
  });

  app.get("/api/v1/market-data/snapshots", async (request) => ({
    items: snapshots.map((item) => ({ ...item, stale: stale(item) })),
    activeVersion: snapshots.find((item) => item.status === "published")?.version ?? null,
    requestId: request.id
  }));

  app.post<{ Params: { id: string }; Body: unknown }>("/api/v1/market-data/snapshots/:id/publish", async (request, reply) => {
    const parsed = macroSnapshotPublishSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "发布参数无效", requestId: request.id } });
    const snapshot = snapshots.find((item) => item.id === request.params.id);
    if (!snapshot) return reply.code(404).send({ error: { code: "NOT_FOUND", message: "宏观快照不存在", requestId: request.id } });
    if (snapshot.version !== parsed.data.expectedVersion) return reply.code(409).send({ error: { code: "VERSION_CONFLICT", message: "宏观快照版本已变化", requestId: request.id } });
    snapshots.filter((item) => item.metric === snapshot.metric && item.status === "published").forEach((item) => {
      item.status = "superseded";
    });
    snapshot.status = "published";
    snapshot.publishedAt = new Date().toISOString();
    snapshot.supersedesId = snapshots.find((item) => item.metric === snapshot.metric && item.id !== snapshot.id && item.status === "superseded")?.id ?? null;
    return { item: snapshot, note: parsed.data.note, requestId: request.id };
  });
}
