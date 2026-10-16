import {
  adminListQuerySchema, adminUserCreateSchema, adminUserUpdateSchema,
  dictionaryCreateSchema, dictionaryUpdateSchema, preferencesUpdateSchema
} from "@hr-console/contracts";
import type { AdminRole, Preferences, RoleCode } from "@hr-console/contracts";
import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import type { PrismaClient } from "../generated/client/index.js";
import { z } from "zod";

export const DEMO_USER_ID = "00000000-0000-4000-8000-000000000001";
export const roles: AdminRole[] = [
  { code: "admin", name: "超级管理员", permissions: ["dashboard:read", "dashboard:write", "intelligence:read", "intelligence:write", "competitors:read", "competitors:write", "briefings:read", "briefings:write", "leads:read", "leads:write", "talents:read", "talents:write", "research-tasks:read", "research-tasks:write", "outreach:read", "outreach:write", "mapping:read", "mapping:write", "organizations:read", "organizations:write", "leaders:read", "leaders:write", "search-projects:read", "search-projects:write", "job-levels:read", "compensation:read", "compensation:write", "admin:read", "admin:write", "settings:read", "settings:write", "notifications:read", "notifications:write", "search:read"] },
  { code: "hr", name: "HR / 招聘负责人", permissions: ["dashboard:read", "dashboard:write", "intelligence:read", "intelligence:write", "competitors:read", "competitors:write", "briefings:read", "briefings:write", "leads:read", "leads:write", "talents:read", "talents:write", "research-tasks:read", "research-tasks:write", "outreach:read", "outreach:write", "mapping:read", "mapping:write", "organizations:read", "organizations:write", "leaders:read", "leaders:write", "search-projects:read", "search-projects:write", "job-levels:read", "compensation:read", "compensation:write", "admin:read", "settings:read", "settings:write", "notifications:read", "notifications:write", "search:read"] },
  { code: "manager", name: "业务管理者", permissions: ["dashboard:read", "intelligence:read", "intelligence:write", "competitors:read", "briefings:read", "leads:read", "talents:read", "research-tasks:read", "outreach:read", "mapping:read", "organizations:read", "leaders:read", "search-projects:read", "job-levels:read", "compensation:read", "settings:read", "settings:write", "notifications:read", "notifications:write", "search:read"] }
];
export type Actor = { id: string; name: string; role: RoleCode; status: "active" | "disabled" };
export const demoActor: Actor = { id: DEMO_USER_ID, name: "Rachel", role: "admin", status: "active" };
export const permissionsFor = (role: RoleCode) => roles.find((item) => item.code === role)?.permissions ?? [];

export const defaultPreferences: Preferences = {
  theme: "dark", density: "comfortable", notifications: true,
  defaultLocation: "beijing", defaultCurrency: "CNY"
};

function defined<T extends object>(value: T): { [K in keyof T]?: Exclude<T[K], undefined> } {
  return Object.fromEntries(Object.entries(value).filter(([, item]) => item !== undefined)) as { [K in keyof T]?: Exclude<T[K], undefined> };
}

function invalid(reply: FastifyReply, requestId: string, message = "请求参数无效") {
  return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message, requestId } });
}
function missing(reply: FastifyReply, requestId: string) {
  return reply.code(404).send({ error: { code: "NOT_FOUND", message: "记录不存在", requestId } });
}
function conflict(reply: FastifyReply, requestId: string) {
  return reply.code(409).send({ error: { code: "CONFLICT", message: "记录已存在或不可修改", requestId } });
}

export function adminRoutes(app: FastifyInstance, db: PrismaClient, getActor: (request: FastifyRequest) => Actor | null): void {
  app.get("/api/v1/me", async (request, reply) => {
    const actor = getActor(request);
    if (!actor) return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "请先登录", requestId: request.id } });
    const user = await db.adminUser.findUnique({ where: { id: actor.id }, include: { preference: true } });
    if (!user || user.status !== "active") return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "账户不可用", requestId: request.id } });
    const { preference, ...record } = user;
    return {
      user: { id: record.id, name: record.name, email: record.email, role: record.role, status: record.status, updatedAt: record.updatedAt.toISOString() },
      permissions: permissionsFor(record.role as RoleCode),
      preferences: preference ? {
        theme: preference.theme, density: preference.density, notifications: preference.notifications,
        defaultLocation: preference.defaultLocation, defaultCurrency: preference.defaultCurrency
      } : defaultPreferences
    };
  });
  app.patch<{ Body: unknown }>("/api/v1/me/preferences", async (request, reply) => {
    const input = preferencesUpdateSchema.safeParse(request.body);
    if (!input.success) return invalid(reply, request.id);
    const actor = getActor(request);
    if (!actor) return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "请先登录", requestId: request.id } });
    const preference = await db.userPreference.upsert({
      where: { userId: actor.id }, create: { userId: actor.id, ...defaultPreferences, ...defined(input.data) },
      update: defined(input.data)
    });
    return { preferences: {
      theme: preference.theme, density: preference.density, notifications: preference.notifications,
      defaultLocation: preference.defaultLocation, defaultCurrency: preference.defaultCurrency
    }, requestId: request.id };
  });
  app.get("/api/v1/admin/roles", async () => ({ items: roles }));
  app.get<{ Querystring: Record<string, string | undefined> }>("/api/v1/admin/users", async (request, reply) => {
    const parsed = adminListQuerySchema.safeParse(request.query);
    if (!parsed.success) return invalid(reply, request.id);
    const { page, pageSize, q, role, status } = parsed.data;
    const where = { ...(role && { role }), ...(status && { status }), ...(q && { OR: [{ name: { contains: q, mode: "insensitive" as const } }, { email: { contains: q, mode: "insensitive" as const } }] }) };
    const [records, total] = await Promise.all([
      db.adminUser.findMany({ where, orderBy: [{ updatedAt: "desc" }, { id: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      db.adminUser.count({ where })
    ]);
    return { items: records.map((user) => ({ ...user, createdAt: undefined, updatedAt: user.updatedAt.toISOString() })), total, page, pageSize, requestId: request.id };
  });
  app.post<{ Body: unknown }>("/api/v1/admin/users", async (request, reply) => {
    const parsed = adminUserCreateSchema.safeParse(request.body);
    if (!parsed.success) return invalid(reply, request.id);
    if (await db.adminUser.findUnique({ where: { email: parsed.data.email } })) return conflict(reply, request.id);
    const user = await db.adminUser.create({ data: parsed.data });
    return reply.code(201).send({ item: { id: user.id, name: user.name, email: user.email, role: user.role, status: user.status, updatedAt: user.updatedAt.toISOString() }, requestId: request.id });
  });
  app.patch<{ Params: { id: string }; Body: unknown }>("/api/v1/admin/users/:id", async (request, reply) => {
    if (!z.uuid().safeParse(request.params.id).success) return invalid(reply, request.id);
    const parsed = adminUserUpdateSchema.safeParse(request.body);
    if (!parsed.success) return invalid(reply, request.id);
    if ((request.params.id === DEMO_USER_ID || request.params.id === getActor(request)?.id) && (parsed.data.status === "disabled" || parsed.data.role && parsed.data.role !== "admin")) return conflict(reply, request.id);
    const result = await db.adminUser.updateMany({ where: { id: request.params.id }, data: defined(parsed.data) });
    if (!result.count) return missing(reply, request.id);
    return { ok: true, requestId: request.id };
  });
  app.get<{ Querystring: Record<string, string | undefined> }>("/api/v1/admin/dictionaries", async (request, reply) => {
    const parsed = adminListQuerySchema.safeParse(request.query);
    if (!parsed.success) return invalid(reply, request.id);
    const { page, pageSize, q, group } = parsed.data;
    const where = { ...(group && { group }), ...(q && { OR: [{ code: { contains: q, mode: "insensitive" as const } }, { label: { contains: q, mode: "insensitive" as const } }] }) };
    const [records, total] = await Promise.all([
      db.dictionaryItem.findMany({ where, orderBy: [{ group: "asc" }, { code: "asc" }], skip: (page - 1) * pageSize, take: pageSize }),
      db.dictionaryItem.count({ where })
    ]);
    return { items: records.map((item) => ({ ...item, createdAt: undefined, updatedAt: item.updatedAt.toISOString() })), total, page, pageSize, requestId: request.id };
  });
  app.post<{ Body: unknown }>("/api/v1/admin/dictionaries", async (request, reply) => {
    const parsed = dictionaryCreateSchema.safeParse(request.body);
    if (!parsed.success) return invalid(reply, request.id);
    if (await db.dictionaryItem.findUnique({ where: { group_code: { group: parsed.data.group, code: parsed.data.code } } })) return conflict(reply, request.id);
    const item = await db.dictionaryItem.create({ data: parsed.data });
    return reply.code(201).send({ item: { id: item.id, group: item.group, code: item.code, label: item.label, enabled: item.enabled, updatedAt: item.updatedAt.toISOString() }, requestId: request.id });
  });
  app.patch<{ Params: { id: string }; Body: unknown }>("/api/v1/admin/dictionaries/:id", async (request, reply) => {
    if (!z.uuid().safeParse(request.params.id).success) return invalid(reply, request.id);
    const parsed = dictionaryUpdateSchema.safeParse(request.body);
    if (!parsed.success) return invalid(reply, request.id);
    const result = await db.dictionaryItem.updateMany({ where: { id: request.params.id }, data: defined(parsed.data) });
    if (!result.count) return missing(reply, request.id);
    return { ok: true, requestId: request.id };
  });
  app.get<{ Querystring: Record<string, string | undefined> }>("/api/v1/admin/audit-logs", async (request, reply) => {
    const parsed = adminListQuerySchema.safeParse(request.query);
    if (!parsed.success) return invalid(reply, request.id);
    const { page, pageSize, action } = parsed.data;
    const where = action ? { action } : {};
    const [records, total] = await Promise.all([
      db.auditLog.findMany({ where, include: { actor: { select: { name: true } } }, orderBy: [{ createdAt: "desc" }, { id: "desc" }], skip: (page - 1) * pageSize, take: pageSize }),
      db.auditLog.count({ where })
    ]);
    return { items: records.map((log) => ({ id: log.id, actorName: log.actor.name, action: log.action, resource: log.resource, resourceId: log.resourceId, requestId: log.requestId, createdAt: log.createdAt.toISOString() })), total, page, pageSize, requestId: request.id };
  });
}
