import { randomUUID } from "node:crypto";
import { mailMessageDetailSchema, mailReplyDetailSchema, mailConnectionSchema, mailFeedbackSchema, mailSuppressionSchema, mailSyncJobSchema } from "@hr-console/contracts";
import type { MailMessageDetail, MailReplyDetail, MailDraftCreate, MailExclusionReasonSchema, MailProvider, MailProjectStageChangeSchema } from "./types.js";
import type { Prisma, PrismaClient, MailConnection } from "../../generated/client/index.js";
import type { Actor } from "../admin.js";
import { permissionsFor } from "../admin.js";
import { hash, MailError, seal, unseal } from "./config.js";
import { exchange } from "./providers.js";
import type { Tokens } from "./providers.js";

export type Tx = Prisma.TransactionClient;
export const json = (value: unknown) => JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
export const now = () => new Date().toISOString();
export const pending = ["draft", "pending_review", "rejected", "approved", "queued", "failed"];
export const accepted = ["sent", "delivered", "replied", "bounced"];
export const connectionDto = (c: MailConnection) => mailConnectionSchema.parse({ id: c.id, ownerId: c.ownerId, provider: c.provider, email: c.email, status: c.status, capabilities: c.capabilities, expiresAt: c.expiresAt?.toISOString() ?? null, lastSyncedAt: c.lastSyncedAt?.toISOString() ?? null, errorCode: c.errorCode, version: c.version, createdAt: c.createdAt.toISOString(), updatedAt: c.updatedAt.toISOString() });
export const feedbackDto = (f: { occurredAt: Date; createdAt: Date }) => mailFeedbackSchema.parse({ ...f, occurredAt: f.occurredAt.toISOString(), createdAt: f.createdAt.toISOString() });
export const suppressionDto = (s: { createdAt: Date }) => mailSuppressionSchema.parse({ ...s, scope: "workspace", createdAt: s.createdAt.toISOString() });
export const syncDto = (s: { createdAt: Date; startedAt: Date | null; finishedAt: Date | null }) => mailSyncJobSchema.strip().parse({ ...s, createdAt: s.createdAt.toISOString(), startedAt: s.startedAt?.toISOString() ?? null, finishedAt: s.finishedAt?.toISOString() ?? null });
export const ownerScope = (actor: Actor): { ownerId?: string } => actor.role === "admin" ? {} : { ownerId: actor.id };
export const messageScope = (actor: Actor): Prisma.MailMessageWhereInput => actor.role === "admin" ? {} : { OR: [{ ownerId: actor.id }, { project: { owner: actor.name } }] };
export function requireSender(m: MailMessageDetail, actor: Actor) {
  if (actor.role !== "admin" && m.ownerId !== actor.id) throw new MailError("PERMISSION_DENIED", 403);
}
export async function audit(tx: Tx, actorId: string | null, resourceId: string, action: string, detail: unknown = {}) {
  await tx.mailAudit.create({ data: { actorId, resourceId, action, detail: json(detail) } });
}
export async function message(tx: Tx, id: string, actor?: Actor): Promise<MailMessageDetail> {
  const row = await tx.mailMessage.findFirst({ where: { id, ...(actor ? messageScope(actor) : {}) } });
  if (!row) throw new MailError("NOT_FOUND", 404);
  return mailMessageDetailSchema.parse(row.payload);
}
export async function connection(tx: Tx, id: string, actor?: Actor, own = false) {
  const row = await tx.mailConnection.findFirst({ where: { id, ...(actor ? own ? { ownerId: actor.id } : ownerScope(actor) : {}) } });
  if (!row) throw new MailError("NOT_FOUND", 404);
  return row;
}
export function expectVersion(actual: number, expected: number) { if (actual !== expected) throw new MailError("VERSION_CONFLICT"); }
export async function saveMessage(tx: Tx, m: MailMessageDetail, changes: Partial<MailMessageDetail>, actorId: string | null, action: string) {
  const next = mailMessageDetailSchema.parse({ ...m, ...changes, version: m.version + 1, updatedAt: now() });
  const updated = await tx.mailMessage.updateMany({ where: { id: m.id, version: m.version }, data: { payload: json(next), status: next.status, version: next.version, recipient: next.recipient, sentAt: next.sentAt ? new Date(next.sentAt) : null, scheduledAt: next.scheduledAt ? new Date(next.scheduledAt) : null, nextAttemptAt: next.nextAttemptAt ? new Date(next.nextAttemptAt) : null } });
  if (updated.count !== 1) throw new MailError("VERSION_CONFLICT");
  await audit(tx, actorId, m.id, action, { before: m.status, after: next.status, version: next.version, contentVersion: next.contentVersion });
  return next;
}
export async function eligibility(tx: Tx, m: MailMessageDetail, forWorker = false): Promise<MailExclusionReasonSchema | null> {
  if (accepted.includes(m.status) || m.status === "delivery_unknown" || m.status === "sending") return "ALREADY_SENT";
  if (m.status === "queued" && !forWorker) return "ALREADY_QUEUED";
  if ((!forWorker && m.status !== "approved") || (forWorker && m.status !== "queued") || m.approval?.decision !== "approved" || m.approval.contentVersion !== m.contentVersion) return "NOT_APPROVED";
  const c = await tx.mailConnection.findUnique({ where: { id: m.connectionId }, include: { owner: true } });
  if (!c || c.status !== "connected" || !c.credentials || c.owner.status !== "active" || !permissionsFor(c.owner.role as Actor["role"]).includes("outreach:write") || !c.capabilities.includes("mail.send")) return "CONNECTION_UNAVAILABLE";
  if (await tx.mailSuppression.findFirst({ where: { OR: [{ email: m.recipient }, { talentId: m.talentId }] } })) return "SUPPRESSED";
  if (m.followUpOfId) {
    const parent = await message(tx, m.followUpOfId);
    if (!["sent", "delivered"].includes(parent.status) || parent.repliedAt || parent.recipient !== m.recipient || parent.talentId !== m.talentId || parent.connectionId !== m.connectionId || parent.projectId !== m.projectId || parent.campaignId !== m.campaignId) return "DUPLICATE_CONTACT";
    if (await tx.mailMessage.findFirst({ where: { id: { not: m.id }, OR: [{ recipient: m.recipient }, { talentId: m.talentId }], status: { in: ["sending", "delivery_unknown", "replied", "bounced"] } } })) return "DUPLICATE_CONTACT";
    // Only one pending or accepted child for a parent; a later follow-up must chain from the latest sent child.
    if (await tx.mailMessage.findFirst({ where: { id: { not: m.id }, payload: { path: ["followUpOfId"], equals: parent.id }, status: { in: ["queued", "sending", "delivery_unknown", ...accepted] } } })) return "DUPLICATE_CONTACT";
  } else if (await tx.mailMessage.findFirst({ where: { id: { not: m.id }, OR: [{ recipient: m.recipient }, { talentId: m.talentId }], status: { in: ["queued", "sending", "delivery_unknown", ...accepted] } } })) return "DUPLICATE_CONTACT";
  return null;
}
export async function stage(tx: Tx, m: MailMessageDetail, target: "contacted" | "replied" | "conversation" | "closed", nextActionAt?: string | null, note?: string): Promise<MailProjectStageChangeSchema | null> {
  if (!m.candidateProjectId) return null;
  const c = await tx.candidateProject.findUnique({ where: { id: m.candidateProjectId } });
  if (!c) return null;
  const ranks: Record<string, number> = { research: 0, longlist: 0, shortlist: 1, ready_to_contact: 1, contacted: 2, replied: 3, conversation: 4, closed: 5 };
  const advance = (ranks[c.stage] ?? 5) < ranks[target]!;
  const update = advance || nextActionAt !== undefined || note !== undefined;
  if (update) {
    const result = await tx.candidateProject.updateMany({ where: { id: c.id, stage: c.stage }, data: { ...(advance ? { stage: target } : {}), ...(nextActionAt !== undefined ? { nextActionAt: nextActionAt ? new Date(nextActionAt) : null } : {}), ...(note !== undefined ? { feedback: note } : {}) } });
    if (result.count !== 1) throw new MailError("VERSION_CONFLICT");
    await audit(tx, null, c.id, "project.feedback", { before: c.stage, after: advance ? target : c.stage, messageId: m.id });
  }
  // Contract reports requested stage and whether it actually advanced; existing later stages are preserved.
  return { candidateProjectId: c.id, projectId: c.projectId, stage: target, changed: advance };
}
export async function suppress(tx: Tx, email: string, talentId: string | null, reason: "manual" | "rejected" | "unsubscribed" | "bounced", note: string, actorId: string | null, sourceReplyId: string | null = null) {
  const row = await tx.mailSuppression.upsert({ where: { email }, create: { email, talentId, reason, note, createdBy: actorId, sourceReplyId }, update: { ...(talentId ? { talentId } : {}) } });
  const rows = await tx.mailMessage.findMany({ where: { status: { in: pending }, OR: [{ recipient: email }, ...(talentId ? [{ talentId }] : [])] } });
  for (const row of rows) {
    const m = mailMessageDetailSchema.parse(row.payload);
    await saveMessage(tx, m, { status: "stopped", stoppedAt: now(), stopReason: reason, nextAttemptAt: null }, actorId, "suppression.stop");
  }
  await audit(tx, actorId, row.id, "suppression.create", { reason, sourceReplyId });
  return row;
}
export async function feedbackEffect(tx: Tx, m: MailMessageDetail, kind: string, note: string, actorId: string | null, replyId: string | null = null, nextActionAt?: string | null) {
  let suppressionId: string | null = null;
  if (["rejected", "unsubscribed", "bounced"].includes(kind)) suppressionId = (await suppress(tx, m.recipient, kind === "bounced" ? null : m.talentId, kind as "rejected" | "unsubscribed" | "bounced", note, actorId, replyId)).id;
  const target = kind === "appointment" ? "conversation" : ["rejected", "unsubscribed"].includes(kind) ? "closed" : ["positive", "discussion", "unknown"].includes(kind) ? "replied" : null;
  const projectStageChange = target ? await stage(tx, m, target, nextActionAt, note) : null;
  return { suppressionId, projectStageChange };
}
export class MailService {
  constructor(public db: PrismaClient) {}
  async transaction<T>(run: (tx: Tx) => Promise<T>): Promise<T> {
    return this.db.$transaction(async tx => {
      // Every mail mutation shares this lock: preview reservation, queue claim, suppression and inbound import are serialized across processes.
      await tx.$queryRaw`SELECT pg_advisory_xact_lock(11011)::text`;
      return run(tx);
    }, { timeout: 30000, maxWait: 10000 });
  }
  async operation<T>(tx: Tx, actor: Actor, operation: string, key: string, input: unknown, run: () => Promise<T>): Promise<T & { replayed: boolean }> {
    const digest = hash(JSON.stringify(input));
    const previous = await tx.mailOperation.findUnique({ where: { actorId_key_operation: { actorId: actor.id, key, operation } } });
    if (previous) {
      if (previous.digest !== digest) throw new MailError("IDEMPOTENCY_CONFLICT");
      return { ...(previous.result as T), replayed: true };
    }
    const result = await run();
    await tx.mailOperation.create({ data: { actorId: actor.id, key, operation, digest, result: json(result) } });
    return { ...result, replayed: false };
  }
  async createDraft(tx: Tx, actor: Actor, input: MailDraftCreate) {
    const c = await connection(tx, input.connectionId, actor, true);
    if (c.status !== "connected") throw new MailError("CONNECTION_UNAVAILABLE");
    if (!await tx.talent.findUnique({ where: { id: input.talentId } })) throw new MailError("NOT_FOUND", 404);
    if (input.projectId && !await tx.searchProject.findUnique({ where: { id: input.projectId } })) throw new MailError("NOT_FOUND", 404);
    if (input.campaignId && !await tx.outreachCampaign.findUnique({ where: { id: input.campaignId } })) throw new MailError("NOT_FOUND", 404);
    if (input.candidateProjectId && !await tx.candidateProject.findFirst({ where: { id: input.candidateProjectId, talentId: input.talentId, projectId: input.projectId! } })) throw new MailError("VALIDATION_ERROR", 400);
    if (input.followUpOfId) {
      const p = await message(tx, input.followUpOfId, actor);
      if (p.recipient !== input.recipient || p.talentId !== input.talentId || p.projectId !== input.projectId || p.campaignId !== input.campaignId || p.connectionId !== c.id || !["sent", "delivered"].includes(p.status) || p.repliedAt) throw new MailError("INVALID_STATE");
    }
    if (/\{\{[^}]+\}\}/.test(input.subject + input.bodyText)) throw new MailError("VALIDATION_ERROR", 400);
    const stamp = now();
    const m = mailMessageDetailSchema.parse({ ...input, id: randomUUID(), ownerId: actor.id, status: "draft", version: 1, contentVersion: 1, approval: null, sentAt: null, deliveredAt: null, repliedAt: null, stoppedAt: null, stopReason: null, attemptCount: 0, maxAttempts: 3, nextAttemptAt: null, lastErrorCode: null, createdAt: stamp, updatedAt: stamp, providerMessageId: null, providerThreadId: null });
    await tx.mailMessage.create({ data: { id: m.id, connectionId: m.connectionId, ownerId: m.ownerId, talentId: m.talentId, projectId: m.projectId, candidateProjectId: m.candidateProjectId, campaignId: m.campaignId, recipient: m.recipient, status: m.status, version: m.version, scheduledAt: m.scheduledAt ? new Date(m.scheduledAt) : null, payload: json(m) } });
    await audit(tx, actor.id, m.id, "draft.create"); return m;
  }
  async token(connectionId: string): Promise<{ connection: MailConnection; token: string }> {
    // Refresh under the same lock; rotated refresh tokens cannot overwrite one another.
    try {
      return await this.transaction(async tx => {
        let c = await connection(tx, connectionId);
        if (c.status !== "connected" || !c.credentials) throw new MailError("AUTH_EXPIRED");
        let tokens = JSON.parse(unseal(c.credentials)) as Tokens;
        if (Date.parse(tokens.expiresAt) < Date.now() + 60000) {
          tokens = await exchange(c.provider as MailProvider, { grant_type: "refresh_token", refresh_token: tokens.refreshToken }, tokens);
          c = await tx.mailConnection.update({ where: { id: c.id }, data: { credentials: seal(JSON.stringify(tokens)), expiresAt: new Date(tokens.expiresAt) } });
        }
        return { connection: c, token: tokens.accessToken };
      });
    } catch (error) {
      if (error instanceof MailError && ["AUTH_EXPIRED", "SCOPE_MISSING", "INVALID_RECIPIENT"].includes(error.code)) {
        await this.transaction(async tx => { await tx.mailConnection.updateMany({ where: { id: connectionId, status: "connected" }, data: { status: "expired", errorCode: "AUTH_EXPIRED", version: { increment: 1 } } }); });
        throw new MailError("AUTH_EXPIRED");
      }
      throw error;
    }
  }
  async reply(tx: Tx, id: string, actor: Actor): Promise<MailReplyDetail> {
    const row = await tx.mailReply.findFirst({ where: { id, message: messageScope(actor) } });
    if (!row) throw new MailError("NOT_FOUND", 404);
    return mailReplyDetailSchema.parse(row.payload);
  }
}
