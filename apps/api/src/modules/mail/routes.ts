import { randomBytes, randomUUID, createHash } from "node:crypto";
import { z, ZodError } from "zod";
import * as c from "@hr-console/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { Prisma, PrismaClient } from "../../generated/client/index.js";
import type { Actor } from "../admin.js";
import { permissionsFor } from "../admin.js";
import { audit, connection, connectionDto, eligibility, expectVersion, feedbackDto, feedbackEffect, json, MailService, message, messageScope, now, ownerScope, pending, requireSender, saveMessage, suppressionDto, suppress, syncDto } from "./service.js";
import { hash, MailError, mailConfig, providerConfig, seal, unseal } from "./config.js";
import { exchange, profile, revoke } from "./providers.js";
import type { Tokens } from "./providers.js";
import { MailWorker } from "./worker.js";

const idSchema = z.object({ id: z.uuid() });
const paramsId = (request: FastifyRequest) => idSchema.parse(request.params).id;
const sessionHash = (request: FastifyRequest) => {
  const token = request.headers.cookie?.match(/(?:^|;\s*)hr_session=([^;]+)/)?.[1];
  if (!token) throw new MailError("UNAUTHORIZED", 401);
  return hash(token);
};
const meta = (q: { page: number; pageSize: number }, total: number, requestId: string) => ({ total, page: q.page, pageSize: q.pageSize, requestId });
const offset = (q: { page: number; pageSize: number }) => ({ skip: (q.page - 1) * q.pageSize, take: q.pageSize });
function messageWhere(q: c.MailMessageListQuery | c.MailFunnelQuery, actor: Actor): Prisma.MailMessageWhereInput {
  const filters: Prisma.MailMessageWhereInput[] = [];
  if (q.templateId) filters.push({ payload: { path: ["templateId"], equals: q.templateId } });
  if ("q" in q && q.q) filters.push({ OR: [{ recipient: { contains: q.q, mode: "insensitive" } }, { payload: { path: ["subject"], string_contains: q.q } }] });
  return { ...messageScope(actor), ...(q.ownerId ? { ownerId: q.ownerId } : {}), ...(q.projectId ? { projectId: q.projectId } : {}), ...(q.campaignId ? { campaignId: q.campaignId } : {}), ...("connectionId" in q && q.connectionId ? { connectionId: q.connectionId } : {}), ...("talentId" in q && q.talentId ? { talentId: q.talentId } : {}), ...("status" in q && q.status ? { status: q.status } : {}), AND: filters };
}

export function mailRoutes(app: FastifyInstance, db: PrismaClient, getActor: (request: FastifyRequest) => Actor | null) {
  const service = new MailService(db); const worker = new MailWorker(service);
  void app.register(async scoped => {
    scoped.setErrorHandler((error, request, reply) => {
      if (error instanceof ZodError) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "邮件参数无效，请检查输入", requestId: request.id } });
      if (error instanceof MailError) return reply.code(error.status).send({ error: { code: error.code, message: error.code, requestId: request.id } });
      // Provider payloads, database queries and decrypted tokens must never enter logs or responses.
      request.log.error({ requestId: request.id, route: request.routeOptions.url }, "mail operation failed");
      return reply.code(503).send({ error: { code: "PROVIDER_UNAVAILABLE", message: "邮件服务暂不可用", requestId: request.id } });
    });
    const actor = (request: FastifyRequest) => { const a = getActor(request); if (!a) throw new MailError("UNAUTHORIZED", 401); return a; };
    scoped.addHook("onReady", async () => worker.start());
    scoped.addHook("onClose", async () => worker.close());

    async function authorize(request: FastifyRequest, provider: c.MailProvider, reconnect?: { id: string; version: number }) {
      const a = actor(request); const config = providerConfig(provider); const session = sessionHash(request);
      const state = randomBytes(32).toString("base64url"); const verifier = randomBytes(48).toString("base64url");
      const expiresAt = new Date(Date.now() + 600000);
      await service.transaction(async tx => {
        const conn = reconnect ? await connection(tx, reconnect.id, a, true) : await tx.mailConnection.create({ data: { ownerId: a.id, provider } });
        if (reconnect) expectVersion(conn.version, reconnect.version);
        await tx.mailOAuthState.deleteMany({ where: { connectionId: conn.id } });
        await tx.mailOAuthState.create({ data: { stateHash: hash(state), sessionHash: session, ownerId: a.id, connectionId: conn.id, connectionVersion: conn.version, provider, verifier: seal(verifier), expiresAt } });
        await audit(tx, a.id, conn.id, reconnect ? "connection.reconnect" : "connection.authorize", { requestId: request.id });
      });
      const url = new URL(config.authorization);
      for (const [key, value] of Object.entries({ client_id: config.clientId, redirect_uri: config.redirectUri, response_type: "code", scope: config.scopes, state, code_challenge_method: "S256", code_challenge: createHash("sha256").update(verifier).digest("base64url"), ...(provider === "google" ? { access_type: "offline", prompt: "consent" } : { response_mode: "query" }) })) url.searchParams.set(key, value);
      return c.mailAuthorizationResponseSchema.parse({ authorizationUrl: url.href, expiresAt: expiresAt.toISOString(), requestId: request.id });
    }
    scoped.get("/api/v1/mail/connections", async request => {
      const a = actor(request); const q = c.mailConnectionListQuerySchema.parse(request.query);
      const where: Prisma.MailConnectionWhereInput = { ...ownerScope(a), ...(q.status ? { status: q.status } : {}), ...(q.q ? { email: { contains: q.q, mode: "insensitive" } } : {}) };
      const [items, total] = await Promise.all([db.mailConnection.findMany({ where, ...offset(q), orderBy: q.sort === "email:asc" ? [{ email: "asc" }, { id: "asc" }] : [{ updatedAt: "desc" }, { id: "asc" }] }), db.mailConnection.count({ where })]);
      return c.mailConnectionListResponseSchema.parse({ items: items.map(connectionDto), ...meta(q, total, request.id) });
    });
    scoped.post("/api/v1/mail/connections/authorize", request => authorize(request, c.mailAuthorizeRequestSchema.parse(request.body).provider));
    scoped.post("/api/v1/mail/connections/:id/reconnect", async request => {
      const input = c.mailReconnectRequestSchema.parse(request.body); const id = paramsId(request);
      const conn = await connection(db, id, actor(request), true);
      return authorize(request, c.mailProviderSchema.parse(conn.provider), { id, version: input.expectedVersion });
    });
    scoped.get("/api/v1/mail/oauth/:provider/callback", async (request, reply) => {
      reply.header("cache-control", "no-store").header("referrer-policy", "no-referrer");
      const a = actor(request);
      if (!permissionsFor(a.role).includes("outreach:write")) throw new MailError("PERMISSION_DENIED", 403);
      const provider = c.mailProviderSchema.parse(z.object({ provider: z.string() }).parse(request.params).provider);
      const query = z.object({ state: z.string().min(20).max(200), code: z.string().max(4096).optional(), error: z.string().max(200).optional() }).parse(request.query);
      const state = await service.transaction(async tx => {
        const state = await tx.mailOAuthState.findUnique({ where: { stateHash: hash(query.state) } });
        if (!state || state.ownerId !== a.id || state.provider !== provider || state.sessionHash !== sessionHash(request) || state.expiresAt.getTime() < Date.now()) throw new MailError("OAUTH_STATE_INVALID", 400);
        const conn = await connection(tx, state.connectionId, a, true); expectVersion(conn.version, state.connectionVersion);
        await tx.mailOAuthState.delete({ where: { stateHash: state.stateHash } }); return state;
      });
      let result = "connected";
      try {
        if (query.error || !query.code) throw new MailError("CONSENT_DENIED");
        const config = providerConfig(provider);
        const tokens = await exchange(provider, { grant_type: "authorization_code", code: query.code, redirect_uri: config.redirectUri, code_verifier: unseal(state.verifier) });
        const email = await profile(provider, tokens.accessToken);
        await service.transaction(async tx => {
          const conn = await connection(tx, state.connectionId, a, true); expectVersion(conn.version, state.connectionVersion);
          if (conn.email && conn.email !== email) throw new MailError("CONNECTION_UNAVAILABLE");
          await tx.mailConnection.update({ where: { id: conn.id }, data: { email, status: "connected", credentials: seal(JSON.stringify(tokens)), expiresAt: new Date(tokens.expiresAt), capabilities: ["mail.read", "mail.send", "offline_access"], errorCode: null, version: { increment: 1 } } });
          await audit(tx, a.id, conn.id, "connection.connected", { provider, requestId: request.id });
        });
      } catch (error) {
        result = error instanceof MailError && ["CONSENT_DENIED", "SCOPE_MISSING", "CONNECTION_UNAVAILABLE"].includes(error.code) ? error.code : "PROVIDER_UNAVAILABLE";
        await service.transaction(async tx => {
          await tx.mailConnection.updateMany({ where: { id: state.connectionId, version: state.connectionVersion }, data: { status: "error", errorCode: result === "CONNECTION_UNAVAILABLE" ? "PROVIDER_UNAVAILABLE" : result, credentials: null, capabilities: [], version: { increment: 1 } } });
          await audit(tx, a.id, state.connectionId, "connection.failed", { code: result, requestId: request.id });
        });
      }
      return reply.code(303).redirect(`${mailConfig.MAIL_WEB_ORIGIN}/mail-review?authorization=${encodeURIComponent(result)}`);
    });
    scoped.post("/api/v1/mail/connections/:id/disconnect", async request => {
      const input = c.mailDisconnectRequestSchema.parse(request.body); const a = actor(request); const id = paramsId(request);
      const result = await service.transaction(async tx => {
        const conn = await connection(tx, id, a, true); expectVersion(conn.version, input.expectedVersion);
        const rows = await tx.mailMessage.findMany({ where: { connectionId: id, status: { in: pending } } });
        for (const row of rows) await saveMessage(tx, c.mailMessageDetailSchema.parse(row.payload), { status: "stopped", stopReason: "connection_disconnected", stoppedAt: now(), nextAttemptAt: null }, a.id, "connection.stop");
        await tx.mailOAuthState.deleteMany({ where: { connectionId: id } });
        await tx.mailSyncJob.updateMany({ where: { connectionId: id, status: { in: ["queued", "running"] } }, data: { status: "failed", errorCode: "AUTH_EXPIRED", finishedAt: new Date() } });
        const next = await tx.mailConnection.update({ where: { id }, data: { status: "disconnected", credentials: null, capabilities: [], expiresAt: null, cursor: null, errorCode: null, version: { increment: 1 } } });
        await audit(tx, a.id, id, "connection.disconnect", { note: input.note, requestId: request.id });
        return { next, previous: conn.credentials, provider: c.mailProviderSchema.parse(conn.provider) };
      });
      if (result.previous) { try { await revoke(result.provider, JSON.parse(unseal(result.previous)) as Tokens); } catch { /* Local credentials are already removed. */ } }
      return connectionDto(result.next);
    });

    scoped.get("/api/v1/mail/messages", async request => {
      const q = c.mailMessageListQuerySchema.parse(request.query); const where = messageWhere(q, actor(request));
      const orderBy: Prisma.MailMessageOrderByWithRelationInput[] = q.sort === "createdAt:desc" ? [{ createdAt: "desc" }, { id: "asc" }] : q.sort === "scheduledAt:asc" ? [{ scheduledAt: "asc" }, { id: "asc" }] : [{ updatedAt: "desc" }, { id: "asc" }];
      const [items, total] = await Promise.all([db.mailMessage.findMany({ where, orderBy, ...offset(q) }), db.mailMessage.count({ where })]);
      return c.mailMessageListResponseSchema.parse({ items: items.map(row => c.mailMessageSummarySchema.strip().parse(row.payload)), ...meta(q, total, request.id) });
    });
    scoped.get("/api/v1/mail/messages/:id", async request => c.mailMessageResponseSchema.parse({ message: await message(db, paramsId(request), actor(request)), requestId: request.id }));
    scoped.post("/api/v1/mail/messages", async (request, reply) => {
      const input = c.mailDraftCreateSchema.parse(request.body);
      const m = await service.transaction(tx => service.createDraft(tx, actor(request), input));
      return reply.code(201).send(c.mailMessageResponseSchema.parse({ message: m, requestId: request.id }));
    });
    scoped.patch("/api/v1/mail/messages/:id", async request => {
      const input = c.mailDraftUpdateSchema.parse(request.body); const a = actor(request);
      const m = await service.transaction(async tx => {
        const m = await message(tx, paramsId(request), a); expectVersion(m.version, input.expectedVersion);
        if (!["draft", "pending_review", "approved", "rejected", "failed"].includes(m.status)) throw new MailError("INVALID_STATE");
        requireSender(m, a);
        if (/\{\{[^}]+\}\}/.test(input.subject + input.bodyText)) throw new MailError("VALIDATION_ERROR", 400);
        return saveMessage(tx, m, { recipient: input.recipient, subject: input.subject, bodyText: input.bodyText, scheduledAt: input.scheduledAt, status: "draft", contentVersion: m.contentVersion + 1, approval: null, providerMessageId: null, providerThreadId: null, lastErrorCode: null, attemptCount: 0, nextAttemptAt: null }, a.id, "draft.edit");
      }); return c.mailMessageResponseSchema.parse({ message: m, requestId: request.id });
    });
    scoped.post("/api/v1/mail/messages/:id/submit-review", async request => {
      const input = c.mailSubmitReviewSchema.parse(request.body); const a = actor(request);
      const m = await service.transaction(async tx => {
        const m = await message(tx, paramsId(request), a); expectVersion(m.version, input.expectedVersion);
        if (!["draft", "rejected"].includes(m.status)) throw new MailError("INVALID_STATE");
        requireSender(m, a);
        return saveMessage(tx, m, { status: "pending_review", approval: null }, a.id, "draft.submit");
      }); return c.mailMessageResponseSchema.parse({ message: m, requestId: request.id });
    });
    scoped.post("/api/v1/mail/messages/:id/review", async request => {
      const input = c.mailReviewDecisionSchema.parse(request.body); const a = actor(request);
      const m = await service.transaction(async tx => {
        const m = await message(tx, paramsId(request), a); expectVersion(m.version, input.expectedVersion);
        const project = m.projectId ? await tx.searchProject.findUnique({ where: { id: m.projectId } }) : null;
        if (a.role !== "admin" && project?.owner !== a.name) throw new MailError("PERMISSION_DENIED", 403);
        if (m.status !== "pending_review") throw new MailError("INVALID_STATE");
        return saveMessage(tx, m, { status: input.decision, approval: { decision: input.decision, contentVersion: m.contentVersion, reviewerId: a.id, reviewedAt: now(), note: input.note } }, a.id, "draft.review");
      }); return c.mailMessageResponseSchema.parse({ message: m, requestId: request.id });
    });
    scoped.post("/api/v1/mail/send-previews", async request => {
      const input = c.mailSendPreviewRequestSchema.parse(request.body); const a = actor(request);
      return service.transaction(async tx => {
        const eligible: c.MailSendPreviewResponse["eligible"] = []; const excluded: c.MailSendPreviewResponse["excluded"] = [];
        const recipients = new Set<string>(); const talents = new Set<string>();
        for (const id of input.messageIds) {
          const m = await message(tx, id, a);
          requireSender(m, a);
          const reason = await eligibility(tx, m) ?? (recipients.has(m.recipient) || talents.has(m.talentId) ? "DUPLICATE_CONTACT" : null);
          if (reason) excluded.push({ messageId: id, recipient: m.recipient, reason });
          else { eligible.push({ messageId: id, expectedVersion: m.version, approvedContentVersion: m.contentVersion, recipient: m.recipient, subject: m.subject, scheduledAt: m.scheduledAt }); recipients.add(m.recipient); talents.add(m.talentId); }
        }
        const expiresAt = new Date(Date.now() + 600000);
        const preview = await tx.mailPreview.create({ data: { actorId: a.id, payload: json({ eligible, excluded }), expiresAt } });
        return c.mailSendPreviewResponseSchema.parse({ previewId: preview.id, expiresAt: expiresAt.toISOString(), eligible, excluded, requestId: request.id });
      });
    });
    scoped.post("/api/v1/mail/send-batches", async (request, reply) => {
      const input = c.mailEnqueueRequestSchema.parse(request.body); const a = actor(request);
      const result = await service.transaction(tx => service.operation(tx, a, "enqueue", input.idempotencyKey, input, async () => {
        const preview = await tx.mailPreview.findFirst({ where: { id: input.previewId, actorId: a.id } });
        if (!preview || preview.expiresAt.getTime() < Date.now()) throw new MailError("PREVIEW_EXPIRED");
        const saved = c.mailSendPreviewResponseSchema.pick({ eligible: true, excluded: true }).parse(preview.payload);
        if (!saved.eligible.length) throw new MailError("APPROVAL_REQUIRED");
        const ids: string[] = [];
        for (const item of saved.eligible) {
          const m = await message(tx, item.messageId, a); expectVersion(m.version, item.expectedVersion);
          requireSender(m, a);
          const reason = await eligibility(tx, m); if (reason) throw new MailError(reason === "NOT_APPROVED" ? "APPROVAL_REQUIRED" : reason);
          await saveMessage(tx, m, { status: "queued", nextAttemptAt: m.scheduledAt ?? now(), lastErrorCode: null }, a.id, "send.enqueue"); ids.push(m.id);
        }
        return { batchId: randomUUID(), messageIds: ids };
      }));
      return reply.code(result.replayed ? 200 : 202).send(c.mailEnqueueResponseSchema.parse({ ...result, requestId: request.id }));
    });
    scoped.post("/api/v1/mail/messages/:id/retry", async (request, reply) => {
      const input = c.mailRetryRequestSchema.parse(request.body); const a = actor(request); const id = paramsId(request);
      const result = await service.transaction(tx => service.operation(tx, a, `retry:${id}`, input.idempotencyKey, input, async () => {
        const m = await message(tx, id, a); expectVersion(m.version, input.expectedVersion);
        if (m.status === "delivery_unknown") throw new MailError("DELIVERY_UNKNOWN");
        requireSender(m, a);
        if (m.status !== "failed" || !["RATE_LIMITED", "PROVIDER_UNAVAILABLE", "AUTH_EXPIRED"].includes(m.lastErrorCode ?? "")) throw new MailError("INVALID_STATE");
        if (m.attemptCount >= m.maxAttempts) throw new MailError("RETRY_EXHAUSTED");
        const reason = await eligibility(tx, { ...m, status: "approved" }); if (reason) throw new MailError(reason === "NOT_APPROVED" ? "APPROVAL_REQUIRED" : reason);
        return { message: await saveMessage(tx, m, { status: "queued", nextAttemptAt: now(), lastErrorCode: null }, a.id, "send.retry") };
      }));
      return reply.code(result.replayed ? 200 : 202).send(c.mailMessageResponseSchema.parse({ message: result.message, requestId: request.id }));
    });
    scoped.post("/api/v1/mail/messages/:id/stop", async request => {
      const input = c.mailStopRequestSchema.parse(request.body); const a = actor(request);
      const m = await service.transaction(async tx => {
        const m = await message(tx, paramsId(request), a); expectVersion(m.version, input.expectedVersion);
        if (!pending.includes(m.status)) throw new MailError("INVALID_STATE");
        await audit(tx, a.id, m.id, "stop.reason", { note: input.note });
        return saveMessage(tx, m, { status: "stopped", stoppedAt: now(), stopReason: "manual", nextAttemptAt: null }, a.id, "send.stop");
      }); return c.mailMessageResponseSchema.parse({ message: m, requestId: request.id });
    });

    scoped.post("/api/v1/mail/connections/:id/sync", async (request, reply) => {
      const input = c.mailSyncRequestSchema.parse(request.body); const a = actor(request); const id = paramsId(request);
      const result = await service.transaction(tx => service.operation(tx, a, `sync:${id}`, input.idempotencyKey, input, async () => {
        const conn = await connection(tx, id, a, true); expectVersion(conn.version, input.expectedVersion);
        if (conn.status !== "connected" || !conn.capabilities.includes("mail.read")) throw new MailError("CONNECTION_UNAVAILABLE");
        const existing = await tx.mailSyncJob.findFirst({ where: { connectionId: id, status: { in: ["queued", "running"] } } });
        const job = existing ?? await tx.mailSyncJob.create({ data: { connectionId: id } });
        await audit(tx, a.id, job.id, "sync.enqueue", { requestId: request.id }); return { job: syncDto(job) };
      }));
      return reply.code(result.replayed ? 200 : 202).send(c.mailSyncResponseSchema.parse({ ...result, requestId: request.id }));
    });
    scoped.get("/api/v1/mail/sync-jobs/:id", async request => {
      const job = await db.mailSyncJob.findFirst({ where: { id: paramsId(request), connection: { ownerId: actor(request).id } } });
      if (!job) throw new MailError("NOT_FOUND", 404); return syncDto(job);
    });
    scoped.get("/api/v1/mail/replies", async request => {
      const q = c.mailReplyListQuerySchema.parse(request.query); const a = actor(request);
      const filters: Prisma.MailReplyWhereInput[] = [];
      for (const [key, value] of Object.entries({ projectId: q.projectId, campaignId: q.campaignId, classification: q.classification })) if (value) filters.push({ payload: { path: [key], equals: value } });
      if (q.q) filters.push({ payload: { path: ["subject"], string_contains: q.q } });
      const where: Prisma.MailReplyWhereInput = { message: messageScope(a), ...(q.connectionId ? { connectionId: q.connectionId } : {}), AND: filters };
      const [items, total] = await Promise.all([db.mailReply.findMany({ where, ...offset(q), orderBy: [{ receivedAt: q.sort === "receivedAt:asc" ? "asc" : "desc" }, { id: "asc" }] }), db.mailReply.count({ where })]);
      return c.mailReplyListResponseSchema.parse({ items: items.map(row => c.mailReplySchema.strip().parse(row.payload)), ...meta(q, total, request.id) });
    });
    scoped.get("/api/v1/mail/replies/:id", async request => c.mailReplyResponseSchema.parse({ reply: await service.reply(db, paramsId(request), actor(request)), requestId: request.id }));
    scoped.patch("/api/v1/mail/replies/:id/feedback", async request => {
      const input = c.mailFeedbackCorrectionSchema.parse(request.body); const a = actor(request);
      const result = await service.transaction(async tx => {
        const r = await service.reply(tx, paramsId(request), a); expectVersion(r.version, input.expectedVersion);
        const reply = c.mailReplyDetailSchema.parse({ ...r, classification: input.classification, classificationSource: "human", reviewedBy: a.id, reviewedAt: now(), reviewNote: input.note, version: r.version + 1, updatedAt: now() });
        await tx.mailReply.update({ where: { id: r.id }, data: { payload: json(reply) } });
        const m = await message(tx, r.messageId, a);
        const effect = await feedbackEffect(tx, m, input.classification, input.note, a.id, r.id, input.nextActionAt);
        await audit(tx, a.id, r.id, "reply.correct", { before: r.classification, after: reply.classification, note: input.note, requestId: request.id });
        return { reply, ...effect };
      }); return c.mailFeedbackCorrectionResponseSchema.parse({ ...result, requestId: request.id });
    });
    scoped.post("/api/v1/mail/messages/:id/feedback", async (request, reply) => {
      const input = c.mailManualFeedbackCreateSchema.parse(request.body); const a = actor(request); const id = paramsId(request);
      if (Date.parse(input.occurredAt) > Date.now() + 300000) throw new MailError("VALIDATION_ERROR", 400);
      const result = await service.transaction(tx => service.operation(tx, a, `feedback:${id}`, input.idempotencyKey, input, async () => {
        const m = await message(tx, id, a); expectVersion(m.version, input.expectedVersion);
        if (!m.sentAt) throw new MailError("INVALID_STATE");
        const event = await tx.mailFeedback.create({ data: { messageId: id, kind: input.kind, source: "human", actorId: a.id, note: input.note, occurredAt: new Date(input.occurredAt) } });
        await saveMessage(tx, m, {}, a.id, "feedback.manual");
        const effect = await feedbackEffect(tx, m, input.kind, input.note, a.id);
        return { feedback: feedbackDto(event), ...effect };
      }));
      return reply.code(result.replayed ? 200 : 201).send(c.mailManualFeedbackResponseSchema.parse({ ...result, requestId: request.id }));
    });
    scoped.get("/api/v1/mail/suppressions", async request => {
      actor(request); const q = c.mailSuppressionListQuerySchema.parse(request.query);
      const where: Prisma.MailSuppressionWhereInput = { ...(q.reason ? { reason: q.reason } : {}), ...(q.q ? { email: { contains: q.q, mode: "insensitive" } } : {}) };
      const [items, total] = await Promise.all([db.mailSuppression.findMany({ where, ...offset(q), orderBy: q.sort === "email:asc" ? [{ email: "asc" }, { id: "asc" }] : [{ createdAt: "desc" }, { id: "asc" }] }), db.mailSuppression.count({ where })]);
      return c.mailSuppressionListResponseSchema.parse({ items: items.map(suppressionDto), ...meta(q, total, request.id) });
    });
    scoped.post("/api/v1/mail/suppressions", async (request, reply) => {
      const input = c.mailSuppressionCreateSchema.parse(request.body); const a = actor(request);
      const row = await service.transaction(async tx => {
        if (input.talentId && !await tx.talent.findUnique({ where: { id: input.talentId } })) throw new MailError("NOT_FOUND", 404);
        const row = await suppress(tx, input.email, input.talentId, input.reason, input.note, a.id);
        if (input.reason !== "manual") {
          const messages = await tx.mailMessage.findMany({ where: { OR: [{ recipient: input.email }, ...(input.talentId ? [{ talentId: input.talentId }] : [])] } });
          for (const m of messages) await feedbackEffect(tx, c.mailMessageDetailSchema.parse(m.payload), input.reason, input.note, a.id);
        }
        return row;
      }); return reply.code(201).send(suppressionDto(row));
    });
    scoped.get("/api/v1/mail/funnel", async request => {
      const q = c.mailFunnelQuerySchema.parse(request.query); const a = actor(request);
      const rows = await db.mailMessage.findMany({ where: { ...messageWhere(q, a), sentAt: { gte: new Date(q.from), lt: new Date(q.to) } }, include: { replies: true, feedback: true } });
      const counts = { sent: rows.length, delivered: 0, replied: 0, effectiveReplies: 0, appointments: 0, rejected: 0, bounced: 0, unsubscribed: 0, manualFeedback: 0 };
      for (const row of rows) {
        const m = c.mailMessageDetailSchema.parse(row.payload); const replies = row.replies.map(r => c.mailReplySchema.strip().parse(r.payload));
        const event = (kind: string) => row.feedback.some(f => f.kind === kind);
        if (m.deliveredAt || event("delivered")) counts.delivered++;
        if (m.repliedAt) counts.replied++;
        if (replies.some(r => ["positive", "discussion"].includes(r.classification))) counts.effectiveReplies++;
        if (event("appointment")) counts.appointments++;
        if (event("rejected") || replies.some(r => r.classification === "rejected")) counts.rejected++;
        if (m.status === "bounced" || event("bounced")) counts.bounced++;
        if (event("unsubscribed") || replies.some(r => r.classification === "unsubscribed")) counts.unsubscribed++;
        if (event("manual")) counts.manualFeedback++;
      }
      return c.mailFunnelResponseSchema.parse({ filters: q, cohort: "first_sent_at", asOf: now(), ...counts, requestId: request.id });
    });
  });
}
