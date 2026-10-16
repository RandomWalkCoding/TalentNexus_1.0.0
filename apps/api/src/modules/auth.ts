import { createHash, randomBytes, scryptSync, timingSafeEqual } from "node:crypto";
import { loginRequestSchema, preferencesSchema } from "@hr-console/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "../generated/client/index.js";
import { DEMO_USER_ID, permissionsFor, type Actor } from "./admin.js";

const SESSION_COOKIE = "hr_session";
const SESSION_TTL_MS = 7 * 24 * 60 * 60 * 1000;

type UserRecord = {
  id: string; name: string; email: string; role: string; status: string; updatedAt: Date;
  passwordHash?: string | null;
  preference?: { theme: string; density: string; notifications: boolean; defaultLocation: string; defaultCurrency: string } | null;
};

export function hashPassword(password: string): string {
  const salt = randomBytes(16).toString("hex");
  const digest = scryptSync(password, salt, 64).toString("hex");
  return `${salt}:${digest}`;
}

function verifyPassword(password: string, encoded: string | null): boolean {
  if (!encoded) return false;
  const [salt, expected] = encoded.split(":");
  if (!salt || !expected) return false;
  const actual = scryptSync(password, salt, 64).toString("hex");
  const expectedBuffer = Buffer.from(expected, "hex");
  const actualBuffer = Buffer.from(actual, "hex");
  return expectedBuffer.length === actualBuffer.length && timingSafeEqual(expectedBuffer, actualBuffer);
}

function tokenHash(token: string): string {
  return createHash("sha256").update(token).digest("hex");
}

function cookies(header: string | undefined): Record<string, string> {
  return Object.fromEntries((header ?? "").split(";").map((part) => part.trim().split("=")).filter(([key, value]) => key && value));
}

function setSessionCookie(reply: FastifyReply, token: string): void {
  const secure = process.env.NODE_ENV === "production" ? "; Secure" : "";
  reply.header("set-cookie", `${SESSION_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${SESSION_TTL_MS / 1000}${secure}`);
}

function clearSessionCookie(reply: FastifyReply): void {
  reply.header("set-cookie", `${SESSION_COOKIE}=; HttpOnly; Path=/; SameSite=Lax; Max-Age=0`);
}

function responseFor(user: UserRecord) {
  const preferences = user.preference ?? { theme: "dark", density: "comfortable", notifications: true, defaultLocation: "beijing", defaultCurrency: "CNY" };
  return {
    user: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, updatedAt: user.updatedAt.toISOString() },
    permissions: permissionsFor(user.role as Actor["role"]),
    preferences: preferencesSchema.parse(preferences)
  };
}

export async function sessionActor(request: FastifyRequest, db: PrismaClient): Promise<Actor | null> {
  const token = cookies(request.headers.cookie)[SESSION_COOKIE];
  if (!token) return null;
  const session = await db.authSession.findFirst({
    where: { tokenHash: tokenHash(token), expiresAt: { gt: new Date() }, user: { status: "active" } },
    include: { user: true }
  });
  if (!session) return null;
  return { id: session.user.id, name: session.user.name, role: session.user.role as Actor["role"], status: "active" };
}

export function authRoutes(app: FastifyInstance, db: PrismaClient): void {
  app.post<{ Body: unknown }>("/api/v1/auth/login", async (request, reply) => {
    const parsed = loginRequestSchema.safeParse(request.body);
    if (!parsed.success) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "请输入有效的邮箱和密码", requestId: request.id } });
    const user = await db.adminUser.findUnique({ where: { email: parsed.data.email.toLowerCase() }, include: { preference: true } });
    if (!user || user.status !== "active" || !verifyPassword(parsed.data.password, user.passwordHash)) {
      return reply.code(401).send({ error: { code: "INVALID_CREDENTIALS", message: "邮箱或密码不正确", requestId: request.id } });
    }
    const token = randomBytes(32).toString("base64url");
    await db.authSession.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS) } });
    setSessionCookie(reply, token);
    return responseFor(user);
  });

  app.post("/api/v1/auth/logout", async (request, reply) => {
    const token = cookies(request.headers.cookie)[SESSION_COOKIE];
    if (token) await db.authSession.deleteMany({ where: { tokenHash: tokenHash(token) } });
    clearSessionCookie(reply);
    return { ok: true, requestId: request.id };
  });

  app.get("/api/v1/auth/demo", async (_request, reply) => {
    if (!["development", "test"].includes(process.env.NODE_ENV ?? "")) return reply.code(404).send();
    const user = await db.adminUser.findUnique({ where: { id: DEMO_USER_ID }, include: { preference: true } });
    if (!user) return reply.code(404).send();
    const token = randomBytes(32).toString("base64url");
    await db.authSession.create({ data: { userId: user.id, tokenHash: tokenHash(token), expiresAt: new Date(Date.now() + SESSION_TTL_MS) } });
    setSessionCookie(reply, token);
    return responseFor(user);
  });
}
