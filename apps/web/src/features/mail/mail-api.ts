import { z } from "zod";
import * as c from "@hr-console/contracts";

export const errors: Record<string, string> = {
  VALIDATION_ERROR: "输入无效，请检查邮箱、关联记录、时间及至少 3 字的原因。", UNAUTHORIZED: "登录已失效，请重新登录。", PERMISSION_DENIED: "没有执行此操作的权限，审批需项目负责人或管理员。",
  NOT_FOUND: "记录不存在或不在你的访问范围内。", VERSION_CONFLICT: "记录已变化，请刷新后重新核对。", INVALID_STATE: "当前状态不支持此操作，请刷新后核对。",
  MAIL_NOT_CONFIGURED: "邮箱服务尚未配置，请管理员设置 OAuth 应用及凭据加密密钥。", CONNECTION_UNAVAILABLE: "邮箱不可用，请检查授权及连接状态。", AUTH_EXPIRED: "邮箱授权失效，请重新连接。", OAUTH_STATE_INVALID: "授权会话已失效，请从当前登录页面重新发起。",
  APPROVAL_REQUIRED: "需要先完成人工审批。", PREVIEW_EXPIRED: "发送预览已过期，请重新预览。", SUPPRESSED: "收件人已在工作区排除名单中。", DUPLICATE_CONTACT: "存在重复触达或前序已经回复，请核对跟进关系。",
  RATE_LIMITED: "已达发送限额，队列会在允许时继续。", OUTSIDE_SEND_WINDOW: "当前不在发送窗口内，将按计划延后发送。", IDEMPOTENCY_CONFLICT: "请求与上次操作不一致，请刷新核对结果。",
  DELIVERY_UNKNOWN: "供应商发送结果待核对，请同步回信并核对已发送邮件。", RETRY_EXHAUSTED: "已达到最大尝试次数，请人工处理。", PROVIDER_UNAVAILABLE: "邮件服务暂不可用，请稍后重试。",
  CONSENT_DENIED: "邮箱授权被取消。", SCOPE_MISSING: "缺少邮件读取、发送或离线授权，请重新授权。", INVALID_RECIPIENT: "收件地址被供应商拒绝，请核对。", SYNC_FAILED: "回信同步失败，可重新发起。", BOUNCED: "供应商确认退信，地址已加入排除名单。"
};
export const errorText = (error: unknown) => error instanceof z.ZodError ? errors.VALIDATION_ERROR! : error instanceof Error ? error.message : "操作失败，请稍后重试。";
export function query(values: Record<string, unknown>) {
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) if (value !== undefined && value !== "") params.set(key, String(value));
  return params.toString();
}
export async function read<T>(schema: z.ZodType<T>, path: string, signal?: AbortSignal): Promise<T> {
  return request(schema, path, signal ? { signal } : {});
}
async function request<T>(schema: z.ZodType<T>, path: string, init: RequestInit): Promise<T> {
  let response: Response;
  try { response = await fetch(`/api/v1/${path}`, { credentials: "same-origin", ...init }); }
  catch (error) { if (init.signal?.aborted) throw error; throw new Error("连接失败，请核对操作结果后重试。"); }
  if (!response.ok) {
    const body = z.object({ error: z.object({ code: z.string(), requestId: z.string().optional() }) }).safeParse(await response.json().catch(() => null));
    const code = body.success ? body.data.error.code : "PROVIDER_UNAVAILABLE";
    throw new Error(`${errors[code] ?? "操作失败，请刷新后重试。"}${body.success && body.data.error.requestId ? `（请求 ${body.data.error.requestId}）` : ""}`);
  }
  return schema.parse(await response.json());
}
export async function write<I, O>(inputSchema: z.ZodType<I>, outputSchema: z.ZodType<O>, path: string, input: unknown, method = "POST") {
  return request(outputSchema, `mail/${path}`, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(inputSchema.parse(input)) });
}
export const sendPreview = (messageIds: string[]) => write(c.mailSendPreviewRequestSchema, c.mailSendPreviewResponseSchema, "send-previews", { messageIds });
export const loadMessage = (id: string, signal?: AbortSignal) => read(c.mailMessageResponseSchema, `mail/messages/${id}`, signal);
export const loadReply = (id: string, signal?: AbortSignal) => read(c.mailReplyResponseSchema, `mail/replies/${id}`, signal);
export const pickOptionsSchema = z.object({ items: z.array(z.object({ id: z.string(), name: z.string() })), total: z.number() });
export const projectOptionsSchema = z.object({ id: z.string(), candidates: z.array(z.object({ id: z.string(), talentId: z.string(), talent: z.object({ name: z.string() }) })) });
