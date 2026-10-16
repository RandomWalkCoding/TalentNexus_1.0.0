import { randomUUID } from "node:crypto";
import { z } from "zod";
import { mailMessageDetailSchema, mailReplyDetailSchema } from "@hr-console/contracts";
import type { MailProvider, MailReplyClassification } from "@hr-console/contracts";
import { audit, connection, eligibility, feedbackEffect, json, message, now, pending, saveMessage, stage } from "./service.js";
import type { MailService } from "./service.js";
import type { Tx } from "./service.js";
import { inSendWindow, mailConfig, MailError } from "./config.js";
import { inboxPage, internetId, reconcile, sendMail } from "./providers.js";
import type { Incoming } from "./providers.js";
import { Prisma } from "../../generated/client/index.js";

function classify(body: string): MailReplyClassification {
  const text = body.split(/\n(?:On .+wrote:|.*写道[：:]|From:|发件人[：:])/i)[0]!.split("\n").filter(line => !line.trim().startsWith(">")).join("\n").slice(0, 4000).trim();
  if (/(?:^|[\n.!。！])\s*(?:unsubscribe|please remove me|请勿再联系|请不要再联系|退订)(?:[\s.!。！]|$)/i.test(text)) return "unsubscribed";
  if (/(?:^|[\n.!。！])\s*(?:not interested|no thanks|不感兴趣|暂不考虑|暂时不考虑)(?:[\s,.!，。！]|$)/i.test(text)) return "rejected";
  if (/^(automatic reply|out of (the )?office|自动回复|休假中)/i.test(text)) return "auto_reply";
  return "unknown";
}
export async function importIncoming(tx: Tx, connectionId: string, incoming: Incoming): Promise<"imported" | "unassociated" | "duplicate"> {
  if (!z.email().safeParse(incoming.sender).success) return "unassociated";
  if (await tx.mailReply.findUnique({ where: { connectionId_providerId: { connectionId, providerId: incoming.id } } })) return "duplicate";
  const rows = await tx.mailMessage.findMany({ where: { connectionId, status: { in: ["sent", "delivered", "replied", "bounced", "delivery_unknown"] }, ...(incoming.bounce ? {} : { recipient: incoming.sender }) }, orderBy: { sentAt: "desc" } });
  const messages = rows.map(row => mailMessageDetailSchema.parse(row.payload));
  const exact = messages.filter(m => incoming.references.includes(internetId(m.id)) || (incoming.bounce && incoming.bodyText.includes(internetId(m.id))));
  const threaded = messages.filter(m => incoming.threadId && m.providerThreadId === incoming.threadId && (!m.sentAt || Date.parse(m.sentAt) <= Date.parse(incoming.receivedAt)));
  const m = exact[0] ?? (!incoming.bounce ? threaded[0] : undefined);
  if (!m) {
    await tx.mailInbound.upsert({ where: { connectionId_providerId: { connectionId, providerId: incoming.id } }, create: { connectionId, providerId: incoming.id, receivedAt: new Date(incoming.receivedAt), payload: json(incoming) }, update: {} });
    return "unassociated";
  }
  const classification = incoming.bounce ? "unknown" : classify(incoming.bodyText);
  const stamp = now(); const replyId = randomUUID();
  const reply = mailReplyDetailSchema.parse({
    id: replyId, messageId: m.id, connectionId, talentId: m.talentId, projectId: m.projectId, candidateProjectId: m.candidateProjectId, campaignId: m.campaignId,
    sender: incoming.sender, subject: incoming.subject, receivedAt: incoming.receivedAt, suggestedClassification: classification, classification,
    classificationSource: classification === "unknown" ? "unclassified" : "rule", confidence: classification === "unknown" ? null : 0.85, aiTaskId: null, suggestedTime: null, concerns: incoming.bounce ? ["供应商退信，需要核对收件地址"] : [], reviewedBy: null, reviewedAt: null, reviewNote: null, version: 1, createdAt: stamp, updatedAt: stamp, bodyText: incoming.bodyText, contentDeletedAt: null
  });
  await tx.mailReply.create({ data: { id: replyId, connectionId, messageId: m.id, providerId: incoming.id, payload: json(reply), receivedAt: new Date(incoming.receivedAt) } });
  if (m.status === "delivery_unknown") await stage(tx, m, "contacted");
  const current = await saveMessage(tx, m, incoming.bounce ? { status: "bounced", lastErrorCode: "BOUNCED", sentAt: m.sentAt ?? incoming.receivedAt } : { status: m.status === "bounced" ? "bounced" : "replied", repliedAt: m.repliedAt ?? incoming.receivedAt, sentAt: m.sentAt ?? incoming.receivedAt }, null, incoming.bounce ? "provider.bounced" : "provider.replied");
  await tx.mailFeedback.create({ data: { messageId: m.id, replyId, kind: incoming.bounce ? "bounced" : "replied", source: "provider", occurredAt: new Date(incoming.receivedAt) } });
  await feedbackEffect(tx, current, incoming.bounce ? "bounced" : classification, incoming.bounce ? "供应商确认退信" : "邮箱同步反馈", null, replyId);
  // Every real reply, including auto replies, pauses all pending outreach to this person for manual handling.
  if (!incoming.bounce) {
    const queued = await tx.mailMessage.findMany({ where: { id: { not: m.id }, status: { in: pending }, OR: [{ talentId: m.talentId }, { recipient: m.recipient }] } });
    for (const row of queued) await saveMessage(tx, mailMessageDetailSchema.parse(row.payload), { status: "stopped", stoppedAt: stamp, stopReason: ["rejected", "unsubscribed"].includes(classification) ? classification as "rejected" | "unsubscribed" : "manual", nextAttemptAt: null }, null, "reply.pause");
  }
  await tx.mailInbound.deleteMany({ where: { connectionId, providerId: incoming.id } });
  await audit(tx, null, replyId, "reply.import", { messageId: m.id, classification });
  return "imported";
}

export class MailWorker {
  private running: Promise<void> | null = null;
  private timer?: ReturnType<typeof setInterval>;
  private closing = false;
  constructor(private service: MailService) {}
  start() {
    if (mailConfig.MAIL_WORKER_ENABLED !== "true" || process.env.NODE_ENV === "test") return;
    this.timer = setInterval(() => this.kick(), 5000); this.timer.unref(); this.kick();
  }
  private kick() {
    if (this.running || this.closing) return;
    this.running = this.tick().catch(() => { /* Persisted tasks stay recoverable. Never log provider exceptions or email data. */ }).finally(() => { this.running = null; });
  }
  async close() { this.closing = true; clearInterval(this.timer); await this.running; }
  private async tick() {
    await this.recover();
    if (this.closing) return;
    await this.scheduleSync();
    await this.synchronize();
    if (this.closing) return;
    await this.dispatch();
    await this.retention();
  }
  private async recover() {
    await this.service.transaction(async tx => {
      const abandoned = await tx.mailMessage.findMany({ where: { status: "sending", leaseUntil: { lt: new Date() } }, take: 20 });
      for (const row of abandoned) await saveMessage(tx, mailMessageDetailSchema.parse(row.payload), { status: "delivery_unknown", lastErrorCode: "DELIVERY_UNKNOWN", nextAttemptAt: null }, null, "send.recover");
      await tx.mailSyncJob.updateMany({ where: { status: "running", leaseUntil: { lt: new Date() } }, data: { status: "queued", leaseUntil: null } });
    });
    const row = await this.service.db.mailMessage.findFirst({ where: { status: "delivery_unknown", OR: [{ leaseUntil: null }, { leaseUntil: { lt: new Date() } }] }, orderBy: { updatedAt: "asc" } });
    if (!row) return;
    await this.service.transaction(async tx => { await tx.mailMessage.updateMany({ where: { id: row.id, status: "delivery_unknown" }, data: { leaseUntil: new Date(Date.now() + 600000) } }); });
    try {
      const m = mailMessageDetailSchema.parse(row.payload); const { connection: c, token } = await this.service.token(m.connectionId);
      const result = await reconcile(c.provider as MailProvider, token, m);
      if (result) await this.accept(m.id, result);
    } catch { /* Unknown delivery is never retried. A future tick or mailbox sync can confirm acceptance. */ }
  }
  private async dispatch() {
    if (!inSendWindow()) return;
    const row = await this.service.db.mailMessage.findFirst({ where: { status: "queued", OR: [{ nextAttemptAt: null }, { nextAttemptAt: { lte: new Date() } }] }, orderBy: [{ nextAttemptAt: "asc" }, { createdAt: "asc" }] });
    if (!row) return;
    let access: Awaited<ReturnType<MailService["token"]>>;
    try { access = await this.service.token(row.connectionId); }
    catch (error) {
      await this.service.transaction(async tx => {
        const m = await message(tx, row.id); if (m.status !== "queued") return;
        if (error instanceof MailError && error.code === "AUTH_EXPIRED") await saveMessage(tx, m, { status: "failed", lastErrorCode: "AUTH_EXPIRED", nextAttemptAt: null }, null, "send.auth_expired");
        else await saveMessage(tx, m, { nextAttemptAt: new Date(Date.now() + 300000).toISOString(), lastErrorCode: "PROVIDER_UNAVAILABLE" }, null, "send.defer");
      }); return;
    }
    const m = await this.service.transaction(async tx => {
      const m = await message(tx, row.id); if (m.status !== "queued" || !inSendWindow()) return null;
      const excluded = await eligibility(tx, m, true);
      if (excluded) {
        await saveMessage(tx, m, { status: "stopped", stoppedAt: now(), stopReason: excluded === "SUPPRESSED" ? "manual" : "connection_disconnected", nextAttemptAt: null }, null, "send.excluded"); return null;
      }
      if (m.scheduledAt && Date.parse(m.scheduledAt) > Date.now()) return null;
      const c = await connection(tx, m.connectionId);
      if (c.version !== access.connection.version || c.credentials !== access.connection.credentials) return null;
      const sent = await tx.mailMessage.findMany({ where: { connectionId: c.id, sentAt: { gte: new Date(Date.now() - 48 * 3600000) } }, select: { sentAt: true } });
      const day = (d: Date) => new Intl.DateTimeFormat("en-CA", { timeZone: mailConfig.MAIL_TIMEZONE, year: "numeric", month: "2-digit", day: "2-digit" }).format(d);
      const count = sent.filter(s => s.sentAt && day(s.sentAt) === day(new Date())).length;
      const unknownCount = await tx.mailMessage.count({ where: { connectionId: c.id, status: { in: ["sending", "delivery_unknown"] } } });
      if (count + unknownCount >= mailConfig.MAIL_DAILY_LIMIT || (c.lastDispatchAt && Date.now() - c.lastDispatchAt.getTime() < mailConfig.MAIL_MIN_INTERVAL_SECONDS * 1000)) {
        await saveMessage(tx, m, { nextAttemptAt: new Date(Date.now() + 60000).toISOString(), lastErrorCode: "RATE_LIMITED" }, null, "send.defer"); return null;
      }
      if (m.attemptCount >= m.maxAttempts) { await saveMessage(tx, m, { status: "failed", lastErrorCode: "RETRY_EXHAUSTED" }, null, "send.exhausted"); return null; }
      const next = await saveMessage(tx, m, { status: "sending", attemptCount: m.attemptCount + 1, nextAttemptAt: null, lastErrorCode: null }, null, "send.claim");
      await tx.mailMessage.update({ where: { id: m.id }, data: { leaseUntil: new Date(Date.now() + 180000) } });
      await tx.mailConnection.update({ where: { id: c.id }, data: { lastDispatchAt: new Date() } });
      return next;
    });
    if (!m) return;
    try {
      const parentRow = m.followUpOfId ? await this.service.db.mailMessage.findUnique({ where: { id: m.followUpOfId } }) : null;
      const result = await sendMail(access.connection.provider as MailProvider, access.token, access.connection.email!, m, async (id, threadId) => {
        await this.service.transaction(async tx => {
          const current = await message(tx, m.id);
          if (current.status !== "sending") throw new MailError("SEND_CANCELLED");
          await saveMessage(tx, current, { providerMessageId: id, providerThreadId: threadId }, null, "send.provider_draft");
        });
      }, async () => {
        await this.service.transaction(async tx => {
          const current = await message(tx, m.id);
          const c = await connection(tx, m.connectionId);
          if (current.status !== "sending" || c.version !== access.connection.version || await eligibility(tx, { ...current, status: "queued" }, true)) throw new MailError("SEND_CANCELLED");
        });
      }, parentRow ? mailMessageDetailSchema.parse(parentRow.payload) : undefined);
      await this.accept(m.id, result);
    } catch (error) {
      const code = error instanceof MailError ? error.code : "DELIVERY_UNKNOWN";
      await this.service.transaction(async tx => {
        const current = await message(tx, m.id); if (!["sending", "delivery_unknown"].includes(current.status)) return;
        if (code === "SEND_CANCELLED") {
          await saveMessage(tx, current, { status: "stopped", stoppedAt: now(), stopReason: "manual", nextAttemptAt: null }, null, "send.cancelled_before_dispatch"); return;
        }
        const unknown = !["AUTH_EXPIRED", "RATE_LIMITED", "INVALID_RECIPIENT", "PROVIDER_UNAVAILABLE"].includes(code);
        // Only definite non-acceptance is retryable. All transport errors in the send call are ambiguous.
        const retry = !unknown && ["RATE_LIMITED", "PROVIDER_UNAVAILABLE"].includes(code) && current.attemptCount < current.maxAttempts;
        const nextAttemptAt = retry ? new Date(Date.now() + Math.min(3600000, 60000 * 2 ** current.attemptCount)).toISOString() : null;
        await saveMessage(tx, current, { status: unknown ? "delivery_unknown" : retry ? "queued" : "failed", lastErrorCode: unknown ? "DELIVERY_UNKNOWN" : current.attemptCount >= current.maxAttempts ? "RETRY_EXHAUSTED" : code as "AUTH_EXPIRED" | "RATE_LIMITED" | "INVALID_RECIPIENT" | "PROVIDER_UNAVAILABLE", nextAttemptAt }, null, "send.failed");
        if (code === "AUTH_EXPIRED") await tx.mailConnection.updateMany({ where: { id: m.connectionId, status: "connected" }, data: { status: "expired", errorCode: "AUTH_EXPIRED", version: { increment: 1 } } });
      });
    }
  }
  private async accept(id: string, result: { id: string; threadId: string | null }) {
    await this.service.transaction(async tx => {
      const m = await message(tx, id); if (!["sending", "delivery_unknown"].includes(m.status)) return;
      const sent = await saveMessage(tx, m, { status: "sent", sentAt: m.sentAt ?? now(), providerMessageId: result.id, providerThreadId: result.threadId, lastErrorCode: null, nextAttemptAt: null }, null, "send.accepted");
      await stage(tx, sent, "contacted");
    });
  }
  private async scheduleSync() {
    await this.service.transaction(async tx => {
      const cutoff = new Date(Date.now() - mailConfig.MAIL_SYNC_INTERVAL_SECONDS * 1000);
      const connections = await tx.mailConnection.findMany({ where: { status: "connected", owner: { status: "active", role: { in: ["admin", "hr"] } }, capabilities: { has: "mail.read" }, syncJobs: { none: { OR: [{ status: { in: ["queued", "running"] } }, { createdAt: { gt: cutoff } }] } } }, take: 20 });
      for (const c of connections) await tx.mailSyncJob.create({ data: { connectionId: c.id } });
    });
  }
  private async synchronize() {
    const job = await this.service.transaction(async tx => {
      const job = await tx.mailSyncJob.findFirst({ where: { status: "queued" }, orderBy: { createdAt: "asc" } });
      if (!job) return null;
      return tx.mailSyncJob.update({ where: { id: job.id }, data: { status: "running", startedAt: new Date(), leaseUntil: new Date(Date.now() + 600000) } });
    });
    if (!job) return;
    try {
      const access = await this.service.token(job.connectionId); const c = access.connection;
      const owner = await this.service.db.adminUser.findUnique({ where: { id: c.ownerId } });
      if (!owner || owner.status !== "active") throw new MailError("AUTH_EXPIRED");
      const start = new Date(); const since = new Date((c.lastSyncedAt?.getTime() ?? Date.now() - 30 * 86400000) - 86400000);
      let cursor = c.provider === "microsoft" ? c.cursor : null;
      let more = true;
      while (more && !this.closing) {
        const page = await inboxPage(c.provider as MailProvider, access.token, since, cursor);
        await this.service.transaction(async tx => {
          const current = await connection(tx, c.id);
          const owned = await tx.mailSyncJob.findFirst({ where: { id: job.id, status: "running", startedAt: job.startedAt, leaseUntil: { gt: new Date() } } });
          if (!owned || current.version !== c.version || current.status !== "connected" || current.credentials !== c.credentials) throw new MailError("SYNC_CANCELLED");
          let imported = 0; let unassociated = 0;
          for (const item of page.items) { const status = await importIncoming(tx, c.id, item); if (status === "imported") imported++; else if (status === "unassociated") unassociated++; }
          await tx.mailSyncJob.update({ where: { id: job.id }, data: { importedCount: { increment: imported }, unassociatedCount: { increment: unassociated }, leaseUntil: new Date(Date.now() + 600000) } });
          await tx.mailConnection.update({ where: { id: c.id }, data: { ...(c.provider === "microsoft" ? { cursor: page.next ?? page.checkpoint } : {}), ...(!page.next ? { lastSyncedAt: start, errorCode: null } : {}) } });
        });
        cursor = page.next; more = !!page.next;
      }
      if (this.closing && more) return;
      await this.service.transaction(async tx => {
        const owned = await tx.mailSyncJob.findFirst({ where: { id: job.id, status: "running", startedAt: job.startedAt, leaseUntil: { gt: new Date() } } });
        if (!owned) return;
        const current = await connection(tx, c.id);
        if (current.status !== "connected" || current.version !== c.version) throw new MailError("SYNC_CANCELLED");
        const pending = await tx.mailInbound.findMany({ where: { connectionId: c.id }, take: 100, orderBy: { receivedAt: "asc" } });
        for (const row of pending) await importIncoming(tx, c.id, row.payload as unknown as Incoming);
        await tx.mailSyncJob.update({ where: { id: job.id }, data: { status: "succeeded", finishedAt: new Date(), leaseUntil: null } });
        await audit(tx, null, job.id, "sync.succeeded");
      });
    } catch (error) {
      const code = error instanceof MailError && error.code === "AUTH_EXPIRED" ? "AUTH_EXPIRED" : "SYNC_FAILED";
      await this.service.transaction(async tx => {
        const updated = await tx.mailSyncJob.updateMany({ where: { id: job.id, status: "running", startedAt: job.startedAt }, data: { status: "failed", finishedAt: new Date(), errorCode: code, leaseUntil: null } });
        if (!updated.count) return;
        if (!(error instanceof MailError && error.code === "SYNC_CANCELLED")) await tx.mailConnection.updateMany({ where: { id: job.connectionId, status: "connected" }, data: { errorCode: code, ...(code === "AUTH_EXPIRED" ? { status: "expired", version: { increment: 1 } } : {}) } });
        await audit(tx, null, job.id, "sync.failed", { code });
      });
    }
  }
  private async retention() {
    await this.service.transaction(async tx => {
      const cutoff = new Date(Date.now() - mailConfig.MAIL_BODY_RETENTION_DAYS * 86400000);
      const rows = await tx.mailReply.findMany({ where: { receivedAt: { lt: cutoff }, payload: { path: ["contentDeletedAt"], equals: Prisma.JsonNull } }, take: 100 });
      for (const row of rows) {
        const reply = mailReplyDetailSchema.parse(row.payload);
        await tx.mailReply.update({ where: { id: row.id }, data: { payload: json({ ...reply, bodyText: null, contentDeletedAt: now(), updatedAt: now(), version: reply.version + 1 }) } });
      }
      await tx.mailInbound.deleteMany({ where: { receivedAt: { lt: cutoff } } });
      await tx.mailOAuthState.deleteMany({ where: { expiresAt: { lt: new Date() } } });
      await tx.mailPreview.deleteMany({ where: { expiresAt: { lt: new Date() } } });
    });
  }
}
