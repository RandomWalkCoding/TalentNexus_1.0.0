import { createCipheriv, createDecipheriv, randomBytes, createHash } from "node:crypto";
import { z } from "zod";
import type { MailProvider } from "@hr-console/contracts";

export class MailError extends Error {
  constructor(public code: string, public status = 409) { super(code); }
}
const settings = z.object({
  MAIL_ENCRYPTION_KEY: z.string().regex(/^[0-9a-fA-F]{64}$/).optional(),
  MAIL_API_ORIGIN: z.url().default("http://localhost:5173"),
  MAIL_WEB_ORIGIN: z.url().default("http://localhost:5173"),
  MAIL_GOOGLE_CLIENT_ID: z.string().optional(), MAIL_GOOGLE_CLIENT_SECRET: z.string().optional(),
  MAIL_MICROSOFT_CLIENT_ID: z.string().optional(), MAIL_MICROSOFT_CLIENT_SECRET: z.string().optional(),
  MAIL_MICROSOFT_TENANT: z.string().regex(/^[A-Za-z0-9.-]+$/).default("common"),
  MAIL_WORKER_ENABLED: z.enum(["true", "false"]).default("true"),
  MAIL_SEND_START_HOUR: z.coerce.number().int().min(0).max(23).default(9),
  MAIL_SEND_END_HOUR: z.coerce.number().int().min(1).max(24).default(18),
  MAIL_TIMEZONE: z.string().default("Asia/Shanghai"),
  MAIL_DAILY_LIMIT: z.coerce.number().int().min(1).max(1000).default(100),
  MAIL_MIN_INTERVAL_SECONDS: z.coerce.number().int().min(10).max(3600).default(60),
  MAIL_SYNC_INTERVAL_SECONDS: z.coerce.number().int().min(60).max(86400).default(300),
  MAIL_BODY_RETENTION_DAYS: z.coerce.number().int().min(1).max(365).default(90)
}).refine(s => s.MAIL_SEND_START_HOUR < s.MAIL_SEND_END_HOUR, "Invalid mail send window");
export const mailConfig = settings.parse(process.env);
new Intl.DateTimeFormat("en", { timeZone: mailConfig.MAIL_TIMEZONE }).format();
for (const origin of [mailConfig.MAIL_API_ORIGIN, mailConfig.MAIL_WEB_ORIGIN]) {
  const url = new URL(origin);
  if (url.origin !== origin || !["http:", "https:"].includes(url.protocol) || (process.env.NODE_ENV === "production" && url.protocol !== "https:")) throw new Error("Mail origins must be HTTP origins (HTTPS in production)");
}
export const hash = (value: string) => createHash("sha256").update(value).digest("hex");
export function seal(value: string): string {
  if (!mailConfig.MAIL_ENCRYPTION_KEY) throw new MailError("MAIL_NOT_CONFIGURED", 503);
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", Buffer.from(mailConfig.MAIL_ENCRYPTION_KEY, "hex"), iv);
  const body = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  return [iv, cipher.getAuthTag(), body].map(part => part.toString("base64url")).join(".");
}
export function unseal(value: string): string {
  try {
    const [iv, tag, body] = value.split(".").map(part => Buffer.from(part, "base64url"));
    const cipher = createDecipheriv("aes-256-gcm", Buffer.from(mailConfig.MAIL_ENCRYPTION_KEY ?? "", "hex"), iv!);
    cipher.setAuthTag(tag!);
    return Buffer.concat([cipher.update(body!), cipher.final()]).toString("utf8");
  } catch { throw new MailError("AUTH_EXPIRED", 409); }
}
export function providerConfig(provider: MailProvider) {
  const google = provider === "google";
  const clientId = google ? mailConfig.MAIL_GOOGLE_CLIENT_ID : mailConfig.MAIL_MICROSOFT_CLIENT_ID;
  const clientSecret = google ? mailConfig.MAIL_GOOGLE_CLIENT_SECRET : mailConfig.MAIL_MICROSOFT_CLIENT_SECRET;
  if (!clientId || !clientSecret || !mailConfig.MAIL_ENCRYPTION_KEY) throw new MailError("MAIL_NOT_CONFIGURED", 503);
  return {
    clientId, clientSecret,
    redirectUri: `${mailConfig.MAIL_API_ORIGIN}/api/v1/mail/oauth/${provider}/callback`,
    authorization: google ? "https://accounts.google.com/o/oauth2/v2/auth" : `https://login.microsoftonline.com/${mailConfig.MAIL_MICROSOFT_TENANT}/oauth2/v2.0/authorize`,
    token: google ? "https://oauth2.googleapis.com/token" : `https://login.microsoftonline.com/${mailConfig.MAIL_MICROSOFT_TENANT}/oauth2/v2.0/token`,
    scopes: google ? "https://www.googleapis.com/auth/gmail.modify" : "offline_access User.Read Mail.ReadWrite Mail.Send"
  };
}
export function inSendWindow(date = new Date()) {
  const hour = Number(new Intl.DateTimeFormat("en-GB", { timeZone: mailConfig.MAIL_TIMEZONE, hour: "2-digit", hourCycle: "h23" }).format(date));
  return hour >= mailConfig.MAIL_SEND_START_HOUR && hour < mailConfig.MAIL_SEND_END_HOUR;
}
