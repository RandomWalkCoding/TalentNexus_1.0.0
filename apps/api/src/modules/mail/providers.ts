import { z } from "zod";
import type { MailMessageDetail, MailProvider } from "@hr-console/contracts";
import { MailError, providerConfig } from "./config.js";

export type Tokens = { accessToken: string; refreshToken: string; expiresAt: string; scopes: string };
export type Incoming = { id: string; threadId: string | null; references: string; sender: string; subject: string; bodyText: string; receivedAt: string; bounce: boolean };
const tokenSchema = z.object({ access_token: z.string().min(1), refresh_token: z.string().optional(), expires_in: z.number().positive(), scope: z.string().optional() });
const googleMessage = z.object({ id: z.string(), threadId: z.string(), internalDate: z.string().optional(), payload: z.unknown() });
const graphMessage = z.object({
  id: z.string(), conversationId: z.string().optional(), internetMessageId: z.string().optional(), isDraft: z.boolean().optional(),
  subject: z.string().nullable().optional(), receivedDateTime: z.string().optional(),
  from: z.object({ emailAddress: z.object({ address: z.string() }) }).optional(),
  body: z.object({ content: z.string(), contentType: z.string() }).optional(),
  internetMessageHeaders: z.array(z.object({ name: z.string(), value: z.string() })).optional()
});
export async function providerRequest(url: string, init: RequestInit = {}, uncertain = false): Promise<unknown> {
  let response: Response;
  try { response = await fetch(url, { ...init, signal: AbortSignal.timeout(20000), redirect: "error" }); }
  catch { throw new MailError(uncertain ? "DELIVERY_UNKNOWN" : "PROVIDER_UNAVAILABLE", 503); }
  if (!response.ok) {
    const code = response.status === 401 || response.status === 403 ? "AUTH_EXPIRED" : response.status === 429 ? "RATE_LIMITED" : uncertain && response.status >= 500 ? "DELIVERY_UNKNOWN" : response.status >= 500 ? "PROVIDER_UNAVAILABLE" : "INVALID_RECIPIENT";
    // Do not read or propagate provider error bodies: they can contain credentials or email content.
    await response.body?.cancel();
    throw new MailError(code, 503);
  }
  if (response.status === 202 || response.status === 204) { await response.body?.cancel(); return {}; }
  try { return await response.json(); } catch { throw new MailError(uncertain ? "DELIVERY_UNKNOWN" : "PROVIDER_UNAVAILABLE", 503); }
}
export async function exchange(provider: MailProvider, values: Record<string, string>, previous?: Tokens): Promise<Tokens> {
  const config = providerConfig(provider);
  const result = tokenSchema.parse(await providerRequest(config.token, {
    method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" },
    body: new URLSearchParams({ client_id: config.clientId, client_secret: config.clientSecret, ...values })
  }));
  const refreshToken = result.refresh_token ?? previous?.refreshToken;
  const scopes = result.scope ?? previous?.scopes ?? "";
  const granted = new Set(scopes.toLowerCase().split(" "));
  const valid = provider === "google" ? granted.has("https://www.googleapis.com/auth/gmail.modify") : ["mail.readwrite", "mail.send", "user.read"].every(s => granted.has(s));
  if (!refreshToken || !valid) throw new MailError("SCOPE_MISSING", 409);
  return { accessToken: result.access_token, refreshToken, scopes, expiresAt: new Date(Date.now() + result.expires_in * 1000).toISOString() };
}
const headers = (token: string) => ({ authorization: `Bearer ${token}`, "content-type": "application/json", Prefer: 'IdType="ImmutableId", outlook.body-content-type="text"' });
const gmail = "https://gmail.googleapis.com/gmail/v1/users/me";
const graph = "https://graph.microsoft.com/v1.0/me";
export async function profile(provider: MailProvider, token: string) {
  if (provider === "google") return z.object({ emailAddress: z.email() }).parse(await providerRequest(`${gmail}/profile`, { headers: headers(token) })).emailAddress.toLowerCase();
  const result = z.object({ mail: z.email().nullable(), userPrincipalName: z.string() }).parse(await providerRequest(`${graph}?$select=mail,userPrincipalName`, { headers: headers(token) }));
  return z.email().parse(result.mail ?? result.userPrincipalName).toLowerCase();
}
export const internetId = (id: string) => `<${id}@hr-console.local>`;
export async function sendMail(provider: MailProvider, token: string, from: string, message: MailMessageDetail, saveProviderId: (id: string, threadId: string | null) => Promise<void>, beforeSend: () => Promise<void>, parent?: MailMessageDetail) {
  if (provider === "google") {
    const mime = [
      `From: ${from}`, `To: ${message.recipient}`, `Subject: =?UTF-8?B?${Buffer.from(message.subject).toString("base64")}?=`,
      `Message-ID: ${internetId(message.id)}`, "MIME-Version: 1.0", "Content-Type: text/plain; charset=UTF-8", "Content-Transfer-Encoding: base64",
      ...(parent ? [`In-Reply-To: ${internetId(parent.id)}`, `References: ${internetId(parent.id)}`] : []), "", Buffer.from(message.bodyText).toString("base64").match(/.{1,76}/g)?.join("\r\n") ?? ""
    ].join("\r\n");
    await beforeSend();
    const result = z.object({ id: z.string(), threadId: z.string() }).parse(await providerRequest(`${gmail}/messages/send`, {
      method: "POST", headers: headers(token), body: JSON.stringify({ raw: Buffer.from(mime).toString("base64url"), ...(parent?.providerThreadId ? { threadId: parent.providerThreadId } : {}) })
    }, true));
    return { id: result.id, threadId: result.threadId };
  }
  let id = message.providerMessageId;
  let threadId = message.providerThreadId;
  if (!id) {
    const result = graphMessage.parse(await providerRequest(`${graph}/messages`, {
      method: "POST", headers: headers(token), body: JSON.stringify({ subject: message.subject, body: { contentType: "Text", content: message.bodyText }, toRecipients: [{ emailAddress: { address: message.recipient } }], internetMessageHeaders: [{ name: "x-hr-message-id", value: message.id }] })
    }));
    id = result.id; threadId = result.conversationId ?? null;
    // Persist the immutable draft id before the send call, so an interrupted send can be reconciled.
    await saveProviderId(id, threadId);
  }
  await beforeSend();
  await providerRequest(`${graph}/messages/${encodeURIComponent(id)}/send`, { method: "POST", headers: headers(token) }, true);
  return { id, threadId };
}
export async function reconcile(provider: MailProvider, token: string, message: MailMessageDetail) {
  if (provider === "google") {
    const result = z.object({ messages: z.array(z.object({ id: z.string(), threadId: z.string() })).optional() }).parse(await providerRequest(`${gmail}/messages?q=${encodeURIComponent(`in:sent rfc822msgid:${internetId(message.id)}`)}`, { headers: headers(token) }));
    const item = result.messages?.[0]; return item ? { id: item.id, threadId: item.threadId } : null;
  }
  if (!message.providerMessageId) return null;
  try {
    const item = graphMessage.parse(await providerRequest(`${graph}/messages/${encodeURIComponent(message.providerMessageId)}?$select=id,isDraft,conversationId`, { headers: headers(token) }));
    return item.isDraft === false ? { id: item.id, threadId: item.conversationId ?? null } : null;
  } catch { return null; }
}
const partSchema = z.object({ mimeType: z.string().optional(), headers: z.array(z.object({ name: z.string(), value: z.string() })).optional(), body: z.object({ data: z.string().optional() }).optional(), parts: z.array(z.unknown()).optional() });
function gmailBody(raw: unknown): string {
  const p = partSchema.parse(raw);
  if (["text/plain", "message/delivery-status"].includes(p.mimeType ?? "") && p.body?.data) return Buffer.from(p.body.data, "base64url").toString("utf8");
  if (p.mimeType === "text/html" && p.body?.data) return textOnly(Buffer.from(p.body.data, "base64url").toString("utf8"));
  const children = p.parts ?? [];
  const plain = children.filter(raw => partSchema.safeParse(raw).data?.mimeType === "text/plain");
  const body = (plain.length && p.mimeType === "multipart/alternative" ? plain : children).map(gmailBody).join("\n");
  return p.mimeType === "message/rfc822" ? `${p.headers?.map(h => `${h.name}: ${h.value}`).join("\n") ?? ""}\n${body}` : body;
}
function textOnly(value: string) { return value.replace(/<script\b[^>]*>[\s\S]*?<\/script>/gi, "").replace(/<style\b[^>]*>[\s\S]*?<\/style>/gi, "").replace(/<[^>]*>/g, " ").replace(/&nbsp;/g, " ").replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&"); }
export async function inboxPage(provider: MailProvider, token: string, since: Date, cursor: string | null): Promise<{ items: Incoming[]; next: string | null; checkpoint: string | null }> {
  if (provider === "google") {
    const url = new URL(`${gmail}/messages`);
    url.searchParams.set("q", `after:${Math.floor(since.getTime() / 1000)} -in:sent -in:drafts`); url.searchParams.set("maxResults", "50");
    if (cursor) url.searchParams.set("pageToken", cursor);
    const list = z.object({ messages: z.array(z.object({ id: z.string() })).optional(), nextPageToken: z.string().optional() }).parse(await providerRequest(url.href, { headers: headers(token) }));
    // Bound provider concurrency to five requests and import every page before advancing the checkpoint.
    const items: Incoming[] = [];
    for (let offset = 0; offset < (list.messages?.length ?? 0); offset += 5) {
      const group = await Promise.all(list.messages!.slice(offset, offset + 5).map(async item => {
        const full = googleMessage.parse(await providerRequest(`${gmail}/messages/${encodeURIComponent(item.id)}?format=full`, { headers: headers(token) }));
        const p = partSchema.parse(full.payload); const h = (key: string) => p.headers?.find(h => h.name.toLowerCase() === key)?.value ?? "";
        const sender = h("from").match(/<([^>]+)>/)?.[1] ?? h("from").trim();
        return { id: full.id, threadId: full.threadId, references: `${h("in-reply-to")} ${h("references")}`, sender: sender.toLowerCase(), subject: h("subject").replace(/[\r\n]/g, " ").slice(0, 300) || "（无主题）", bodyText: gmailBody(full.payload).slice(0, 100000), receivedAt: new Date(Number(full.internalDate ?? Date.now())).toISOString(), bounce: /multipart\/report/i.test(h("content-type")) && /mailer-daemon|postmaster/i.test(sender) };
      })); items.push(...group);
    }
    return { items, next: list.nextPageToken ?? null, checkpoint: null };
  }
  const initial = `${graph}/mailFolders/inbox/messages/delta?$select=id,conversationId,subject,from,body,receivedDateTime,internetMessageHeaders&$filter=receivedDateTime ge ${since.toISOString()}`;
  const url = cursor ?? initial;
  // A stored provider cursor must never become an arbitrary server-side fetch target.
  if (!url.startsWith(`${graph}/`) || new URL(url).origin !== "https://graph.microsoft.com") throw new MailError("SYNC_FAILED", 503);
  const list = z.object({ value: z.array(z.unknown()), "@odata.nextLink": z.string().optional(), "@odata.deltaLink": z.string().optional() }).parse(await providerRequest(url, { headers: headers(token) }));
  const items = list.value.flatMap(raw => {
    const parsed = graphMessage.safeParse(raw); if (!parsed.success || !parsed.data.from || !parsed.data.receivedDateTime) return [];
    const item = parsed.data; const hs = item.internetMessageHeaders ?? [];
    return [{ id: item.id, threadId: item.conversationId ?? null, references: hs.filter(h => /^(in-reply-to|references)$/i.test(h.name)).map(h => h.value).join(" "), sender: item.from!.emailAddress.address.toLowerCase(), subject: (item.subject || "（无主题）").replace(/[\r\n]/g, " ").slice(0, 300), bodyText: (item.body?.contentType.toLowerCase() === "html" ? textOnly(item.body.content) : item.body?.content ?? "").slice(0, 100000), receivedAt: item.receivedDateTime!, bounce: hs.some(h => /^content-type$/i.test(h.name) && /multipart\/report/i.test(h.value)) && /mailer-daemon|postmaster/i.test(item.from!.emailAddress.address) }];
  });
  return { items, next: list["@odata.nextLink"] ?? null, checkpoint: list["@odata.deltaLink"] ?? null };
}
export async function revoke(provider: MailProvider, tokens: Tokens) {
  if (provider === "google") await providerRequest("https://oauth2.googleapis.com/revoke", { method: "POST", headers: { "content-type": "application/x-www-form-urlencoded" }, body: new URLSearchParams({ token: tokens.refreshToken }) });
  // Microsoft has no per-refresh-token revocation endpoint; deleting local credentials terminates app access.
}
