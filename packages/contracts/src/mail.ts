import { z } from "zod";

const id = z.uuid();
const version = z.number().int().positive();
const timestamp = z.iso.datetime();
const note = z.string().trim().min(3).max(2000);
const email = z.email().max(254).transform(value => value.toLowerCase());
const requestId = z.string().min(1);
const idempotencyKey = z.string().min(16).max(128).regex(/^[A-Za-z0-9_-]+$/);
const pageQuery = z.object({
  page: z.coerce.number().int().min(1).default(1),
  pageSize: z.coerce.number().int().min(1).max(100).default(20),
  q: z.string().trim().max(200).optional()
});
const pageMetadata = {
  total: z.number().int().nonnegative(),
  page: z.number().int().positive(),
  pageSize: z.number().int().min(1).max(100),
  requestId
};
const uniqueIds = z.array(id).min(1).max(100).refine(
  values => new Set(values).size === values.length,
  { message: "ID 不能重复" }
);
const httpsUrl = z.url().refine(value => new URL(value).protocol === "https:", {
  message: "授权地址必须使用 HTTPS"
});

export const mailProviderSchema = z.enum(["google", "microsoft"]);
export const mailConnectionStatusSchema = z.enum(["connecting", "connected", "expired", "disconnected", "error"]);
export const mailConnectionErrorSchema = z.enum(["AUTH_EXPIRED", "CONSENT_DENIED", "SCOPE_MISSING", "PROVIDER_UNAVAILABLE", "SYNC_FAILED"]);
// These are application capabilities; provider-specific OAuth scopes stay on the server.
export const mailCapabilitySchema = z.enum(["mail.read", "mail.send", "offline_access"]);
export const mailConnectionSchema = z.object({
  id, provider: mailProviderSchema, ownerId: id, email: email.nullable(),
  status: mailConnectionStatusSchema, capabilities: z.array(mailCapabilitySchema),
  expiresAt: timestamp.nullable(), lastSyncedAt: timestamp.nullable(),
  errorCode: mailConnectionErrorSchema.nullable(), version,
  createdAt: timestamp, updatedAt: timestamp
}).strict();
export const mailConnectionListQuerySchema = pageQuery.extend({
  status: mailConnectionStatusSchema.optional(),
  sort: z.enum(["updatedAt:desc", "email:asc"]).default("updatedAt:desc")
}).strict();
export const mailConnectionListResponseSchema = z.object({ items: z.array(mailConnectionSchema), ...pageMetadata });
export const mailAuthorizeRequestSchema = z.object({ provider: mailProviderSchema }).strict();
export const mailReconnectRequestSchema = z.object({ expectedVersion: version }).strict();
export const mailAuthorizationResponseSchema = z.object({ authorizationUrl: httpsUrl, expiresAt: timestamp, requestId }).strict();
export const mailDisconnectRequestSchema = z.object({ expectedVersion: version, note }).strict();

export const mailMessageStatusSchema = z.enum([
  "draft", "pending_review", "rejected", "approved", "queued", "sending",
  "delivery_unknown", "sent", "delivered", "failed", "bounced", "replied", "stopped"
]);
export const mailDeliveryErrorSchema = z.enum([
  "AUTH_EXPIRED", "RATE_LIMITED", "PROVIDER_UNAVAILABLE", "INVALID_RECIPIENT",
  "DELIVERY_UNKNOWN", "BOUNCED", "RETRY_EXHAUSTED"
]);
export const mailStopReasonSchema = z.enum(["rejected", "unsubscribed", "bounced", "manual", "connection_disconnected"]);
const messageLinks = z.object({
  talentId: z.string().trim().min(1).max(80),
  projectId: id.nullable(), candidateProjectId: id.nullable(), campaignId: z.string().min(1).max(80).nullable()
});
const draftContent = z.object({
  recipient: email,
  subject: z.string().trim().min(1).max(300).refine(value => !/[\r\n]/.test(value), {
    message: "邮件主题不能包含换行"
  }),
  bodyText: z.string().trim().min(1).max(50000)
});
export const mailDraftCreateSchema = z.object({
  ...messageLinks.shape, ...draftContent.shape,
  connectionId: id, templateId: id.nullable().default(null),
  followUpOfId: id.nullable().default(null), scheduledAt: timestamp.nullable().default(null)
}).strict().refine(value => !value.candidateProjectId || !!value.projectId, {
  message: "关联候选人项目时必须指定寻访项目", path: ["projectId"]
});
// A full content replacement prevents stale previews from being merged into an approved draft.
export const mailDraftUpdateSchema = draftContent.extend({
  expectedVersion: version, scheduledAt: timestamp.nullable()
}).strict();
export const mailSubmitReviewSchema = z.object({ expectedVersion: version }).strict();
export const mailReviewDecisionSchema = z.object({
  expectedVersion: version, decision: z.enum(["approved", "rejected"]), note
}).strict();
export const mailApprovalSchema = z.object({
  decision: z.enum(["approved", "rejected"]), contentVersion: version,
  reviewerId: id, reviewedAt: timestamp, note
}).strict();
export const mailMessageSummarySchema = z.object({
  id, ...messageLinks.shape, connectionId: id, ownerId: id,
  recipient: email, subject: draftContent.shape.subject,
  templateId: id.nullable(), followUpOfId: id.nullable(),
  status: mailMessageStatusSchema, version, contentVersion: version,
  approval: mailApprovalSchema.nullable(), scheduledAt: timestamp.nullable(),
  sentAt: timestamp.nullable(), deliveredAt: timestamp.nullable(),
  repliedAt: timestamp.nullable(), stoppedAt: timestamp.nullable(),
  stopReason: mailStopReasonSchema.nullable(), attemptCount: z.number().int().nonnegative(),
  maxAttempts: z.number().int().min(1).max(10), nextAttemptAt: timestamp.nullable(),
  lastErrorCode: mailDeliveryErrorSchema.nullable(),
  createdAt: timestamp, updatedAt: timestamp
}).strict();
export const mailMessageDetailSchema = mailMessageSummarySchema.extend({
  bodyText: draftContent.shape.bodyText,
  // Provider identifiers are metadata, never credentials or raw provider error payloads.
  providerMessageId: z.string().min(1).max(500).nullable(),
  providerThreadId: z.string().min(1).max(500).nullable()
}).strict();
export const mailMessageListQuerySchema = pageQuery.extend({
  connectionId: id.optional(), projectId: id.optional(), campaignId: z.string().min(1).max(80).optional(),
  talentId: z.string().min(1).max(80).optional(), ownerId: id.optional(),
  templateId: id.optional(), status: mailMessageStatusSchema.optional(),
  sort: z.enum(["updatedAt:desc", "createdAt:desc", "scheduledAt:asc"]).default("updatedAt:desc")
}).strict();
export const mailMessageListResponseSchema = z.object({ items: z.array(mailMessageSummarySchema), ...pageMetadata });
export const mailMessageResponseSchema = z.object({ message: mailMessageDetailSchema, requestId });

export const mailExclusionReasonSchema = z.enum([
  "NOT_APPROVED", "VERSION_CONFLICT", "SUPPRESSED", "DUPLICATE_CONTACT",
  "CONNECTION_UNAVAILABLE", "OUTSIDE_SEND_WINDOW", "RATE_LIMITED", "ALREADY_QUEUED", "ALREADY_SENT"
]);
export const mailSendPreviewRequestSchema = z.object({ messageIds: uniqueIds }).strict();
export const mailSendPreviewResponseSchema = z.object({
  previewId: id, expiresAt: timestamp,
  eligible: z.array(z.object({
    messageId: id, expectedVersion: version, approvedContentVersion: version,
    recipient: email, subject: draftContent.shape.subject, scheduledAt: timestamp.nullable()
  }).strict()).max(100),
  excluded: z.array(z.object({ messageId: id, recipient: email, reason: mailExclusionReasonSchema }).strict()).max(100),
  requestId
}).strict();
// The server stores the preview's immutable message versions and recipient set.
export const mailEnqueueRequestSchema = z.object({ previewId: id, idempotencyKey }).strict();
export const mailEnqueueResponseSchema = z.object({
  batchId: id, messageIds: uniqueIds, replayed: z.boolean(), requestId
}).strict();
export const mailRetryRequestSchema = z.object({ expectedVersion: version, idempotencyKey }).strict();
export const mailStopRequestSchema = z.object({ expectedVersion: version, note }).strict();

export const mailReplyClassificationSchema = z.enum(["positive", "discussion", "rejected", "auto_reply", "unknown", "unsubscribed"]);
export const mailReplySchema = z.object({
  id, messageId: id, connectionId: id, ...messageLinks.shape,
  sender: email, subject: draftContent.shape.subject, receivedAt: timestamp,
  suggestedClassification: mailReplyClassificationSchema,
  classification: mailReplyClassificationSchema,
  classificationSource: z.enum(["rule", "ai", "human", "unclassified"]),
  confidence: z.number().min(0).max(1).nullable(), aiTaskId: id.nullable(),
  suggestedTime: z.string().max(1000).nullable(), concerns: z.array(z.string().max(1000)).max(20),
  reviewedBy: id.nullable(), reviewedAt: timestamp.nullable(), reviewNote: note.nullable(),
  version, createdAt: timestamp, updatedAt: timestamp
}).strict();
export const mailReplyDetailSchema = mailReplySchema.extend({
  bodyText: z.string().max(100000).nullable(), contentDeletedAt: timestamp.nullable()
}).strict();
export const mailReplyListQuerySchema = pageQuery.extend({
  connectionId: id.optional(), projectId: id.optional(), campaignId: z.string().min(1).max(80).optional(),
  classification: mailReplyClassificationSchema.optional(),
  sort: z.enum(["receivedAt:desc", "receivedAt:asc"]).default("receivedAt:desc")
}).strict();
export const mailReplyListResponseSchema = z.object({ items: z.array(mailReplySchema), ...pageMetadata });
export const mailReplyResponseSchema = z.object({ reply: mailReplyDetailSchema, requestId });
export const mailFeedbackCorrectionSchema = z.object({
  expectedVersion: version, classification: mailReplyClassificationSchema,
  note, nextActionAt: timestamp.nullable()
}).strict();
export const mailProjectStageChangeSchema = z.object({
  candidateProjectId: id, projectId: id,
  stage: z.enum(["contacted", "replied", "conversation", "closed"]),
  changed: z.boolean()
}).strict();
export const mailFeedbackCorrectionResponseSchema = z.object({
  reply: mailReplyDetailSchema, projectStageChange: mailProjectStageChangeSchema.nullable(),
  suppressionId: id.nullable(), requestId
}).strict();

export const mailFeedbackKindSchema = z.enum([
  "delivered", "replied", "effective_reply", "appointment", "rejected", "bounced", "unsubscribed", "manual"
]);
export const mailFeedbackSchema = z.object({
  id, messageId: id, replyId: id.nullable(), kind: mailFeedbackKindSchema,
  source: z.enum(["provider", "rule", "ai", "human"]),
  actorId: id.nullable(), note: note.nullable(), occurredAt: timestamp, createdAt: timestamp
}).strict();
export const mailManualFeedbackCreateSchema = z.object({
  expectedVersion: version, idempotencyKey,
  kind: z.enum(["appointment", "rejected", "unsubscribed", "manual"]),
  note, occurredAt: timestamp
}).strict();
export const mailManualFeedbackResponseSchema = z.object({
  feedback: mailFeedbackSchema, projectStageChange: mailProjectStageChangeSchema.nullable(),
  suppressionId: id.nullable(), replayed: z.boolean(), requestId
}).strict();

export const mailSuppressionReasonSchema = z.enum(["rejected", "unsubscribed", "bounced", "manual"]);
export const mailSuppressionSchema = z.object({
  id, email, talentId: z.string().min(1).max(80).nullable(),
  reason: mailSuppressionReasonSchema, sourceReplyId: id.nullable(),
  createdBy: id.nullable(), note, createdAt: timestamp,
  // Suppression applies across projects, campaigns and connected mailboxes.
  scope: z.literal("workspace")
}).strict();
export const mailSuppressionCreateSchema = z.object({
  email, talentId: z.string().trim().min(1).max(80).nullable().default(null),
  reason: z.enum(["rejected", "unsubscribed", "manual"]), note
}).strict();
export const mailSuppressionListQuerySchema = pageQuery.extend({
  reason: mailSuppressionReasonSchema.optional(),
  sort: z.enum(["createdAt:desc", "email:asc"]).default("createdAt:desc")
}).strict();
export const mailSuppressionListResponseSchema = z.object({ items: z.array(mailSuppressionSchema), ...pageMetadata });

export const mailSyncRequestSchema = z.object({ expectedVersion: version, idempotencyKey }).strict();
export const mailSyncJobSchema = z.object({
  id, connectionId: id, status: z.enum(["queued", "running", "succeeded", "failed"]),
  importedCount: z.number().int().nonnegative(), unassociatedCount: z.number().int().nonnegative(),
  errorCode: mailConnectionErrorSchema.nullable(),
  createdAt: timestamp, startedAt: timestamp.nullable(), finishedAt: timestamp.nullable()
}).strict();
export const mailSyncResponseSchema = z.object({ job: mailSyncJobSchema, replayed: z.boolean(), requestId });

export const mailFunnelQuerySchema = z.object({
  from: timestamp, to: timestamp,
  projectId: id.optional(), campaignId: z.string().min(1).max(80).optional(), ownerId: id.optional(), templateId: id.optional()
}).strict().refine(value => Date.parse(value.from) < Date.parse(value.to), {
  message: "开始时间必须早于结束时间", path: ["from"]
});
const count = z.number().int().nonnegative();
export const mailFunnelResponseSchema = z.object({
  filters: mailFunnelQuerySchema,
  cohort: z.literal("first_sent_at"), asOf: timestamp,
  sent: count, delivered: count, replied: count, effectiveReplies: count,
  appointments: count, rejected: count, bounced: count, unsubscribed: count,
  manualFeedback: count, requestId
}).strict();

export const mailErrorCodeSchema = z.enum([
  "VALIDATION_ERROR", "UNAUTHORIZED", "PERMISSION_DENIED", "NOT_FOUND", "VERSION_CONFLICT",
  "INVALID_STATE", "MAIL_NOT_CONFIGURED", "CONNECTION_UNAVAILABLE", "AUTH_EXPIRED", "OAUTH_STATE_INVALID",
  "APPROVAL_REQUIRED", "PREVIEW_EXPIRED", "SUPPRESSED", "DUPLICATE_CONTACT", "RATE_LIMITED",
  "OUTSIDE_SEND_WINDOW", "IDEMPOTENCY_CONFLICT", "DELIVERY_UNKNOWN", "RETRY_EXHAUSTED", "PROVIDER_UNAVAILABLE"
]);

export type MailProvider = z.infer<typeof mailProviderSchema>;
export type MailConnectionStatus = z.infer<typeof mailConnectionStatusSchema>;
export type MailConnection = z.infer<typeof mailConnectionSchema>;
export type MailConnectionListQuery = z.infer<typeof mailConnectionListQuerySchema>;
export type MailConnectionListResponse = z.infer<typeof mailConnectionListResponseSchema>;
export type MailAuthorizeRequest = z.infer<typeof mailAuthorizeRequestSchema>;
export type MailAuthorizationResponse = z.infer<typeof mailAuthorizationResponseSchema>;
export type MailReconnectRequest = z.infer<typeof mailReconnectRequestSchema>;
export type MailDisconnectRequest = z.infer<typeof mailDisconnectRequestSchema>;
export type MailMessageStatus = z.infer<typeof mailMessageStatusSchema>;
export type MailDraftCreate = z.infer<typeof mailDraftCreateSchema>;
export type MailDraftUpdate = z.infer<typeof mailDraftUpdateSchema>;
export type MailSubmitReview = z.infer<typeof mailSubmitReviewSchema>;
export type MailReviewDecision = z.infer<typeof mailReviewDecisionSchema>;
export type MailMessageSummary = z.infer<typeof mailMessageSummarySchema>;
export type MailMessageDetail = z.infer<typeof mailMessageDetailSchema>;
export type MailMessageListQuery = z.infer<typeof mailMessageListQuerySchema>;
export type MailMessageListResponse = z.infer<typeof mailMessageListResponseSchema>;
export type MailMessageResponse = z.infer<typeof mailMessageResponseSchema>;
export type MailSendPreviewRequest = z.infer<typeof mailSendPreviewRequestSchema>;
export type MailSendPreviewResponse = z.infer<typeof mailSendPreviewResponseSchema>;
export type MailEnqueueRequest = z.infer<typeof mailEnqueueRequestSchema>;
export type MailEnqueueResponse = z.infer<typeof mailEnqueueResponseSchema>;
export type MailRetryRequest = z.infer<typeof mailRetryRequestSchema>;
export type MailStopRequest = z.infer<typeof mailStopRequestSchema>;
export type MailReplyClassification = z.infer<typeof mailReplyClassificationSchema>;
export type MailReply = z.infer<typeof mailReplySchema>;
export type MailReplyDetail = z.infer<typeof mailReplyDetailSchema>;
export type MailReplyListQuery = z.infer<typeof mailReplyListQuerySchema>;
export type MailReplyListResponse = z.infer<typeof mailReplyListResponseSchema>;
export type MailReplyResponse = z.infer<typeof mailReplyResponseSchema>;
export type MailFeedbackCorrection = z.infer<typeof mailFeedbackCorrectionSchema>;
export type MailFeedbackCorrectionResponse = z.infer<typeof mailFeedbackCorrectionResponseSchema>;
export type MailFeedbackKind = z.infer<typeof mailFeedbackKindSchema>;
export type MailFeedback = z.infer<typeof mailFeedbackSchema>;
export type MailManualFeedbackCreate = z.infer<typeof mailManualFeedbackCreateSchema>;
export type MailManualFeedbackResponse = z.infer<typeof mailManualFeedbackResponseSchema>;
export type MailSuppression = z.infer<typeof mailSuppressionSchema>;
export type MailSuppressionCreate = z.infer<typeof mailSuppressionCreateSchema>;
export type MailSuppressionListQuery = z.infer<typeof mailSuppressionListQuerySchema>;
export type MailSuppressionListResponse = z.infer<typeof mailSuppressionListResponseSchema>;
export type MailSyncRequest = z.infer<typeof mailSyncRequestSchema>;
export type MailSyncJob = z.infer<typeof mailSyncJobSchema>;
export type MailSyncResponse = z.infer<typeof mailSyncResponseSchema>;
export type MailFunnelQuery = z.infer<typeof mailFunnelQuerySchema>;
export type MailFunnelResponse = z.infer<typeof mailFunnelResponseSchema>;
export type MailErrorCode = z.infer<typeof mailErrorCodeSchema>;
