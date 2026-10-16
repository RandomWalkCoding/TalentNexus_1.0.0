import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PrismaClient } from "../generated/client/index.js";
import { demoActor, permissionsFor } from "./admin.js";
import type { Actor } from "./admin.js";
import { sessionActor } from "./auth.js";

type AccessOptions = {
  identity?: (request?: FastifyRequest) => Actor | null | Promise<Actor | null>;
  audit?: (entry: { actorId: string; action: string; resource: string; resourceId: string | null; requestId: string }) => Promise<void>;
};

const readMethods = new Set(["GET", "HEAD", "OPTIONS"]);

function resourceFor(path: string): string | null {
  const resource = path.split("/")[3];
  if (!resource) return null;
  if (resource === "me") return "settings";
  if (resource === "storage") return "settings";
  if (resource === "talent-categories") return "talents";
  if (resource === "admin") return "admin";
  if (resource === "leaders") return "leaders";
  if (resource === "search-projects") return "search-projects";
  if (resource === "level-benchmarks") return "mapping";
  if (resource === "ai") return "intelligence";
  if (resource === "mail") return "outreach";
  if (resource === "market-data") return "compensation";
  return resource;
}

export function registerAccess(app: FastifyInstance, db: PrismaClient, options: AccessOptions = {}) {
  const actors = new WeakMap<FastifyRequest, Actor>();
  const getActor = (request: FastifyRequest) => actors.get(request) ?? null;
  const identity = options.identity ?? (async (request?: FastifyRequest) => {
    if (process.env.NODE_ENV === "test") return demoActor;
    return request ? sessionActor(request, db) : null;
  });
  const audit = options.audit ?? (process.env.NODE_ENV === "test" ? null : async (entry: Parameters<NonNullable<AccessOptions["audit"]>>[0]) => {
    await db.auditLog.create({ data: entry });
  });

  app.addHook("preHandler", async (request, reply) => {
    const path = request.url.split("?")[0] ?? "";
    if (!path.startsWith("/api/v1/") || path === "/api/v1/health" || path === "/api/v1/ready" || path.startsWith("/api/v1/auth/")) return;
    reply.header("cache-control", "no-store");
    const actor = await identity(request);
    if (!actor || actor.status !== "active") {
      return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "请先登录或联系管理员", requestId: request.id } });
    }
    actors.set(request, actor);
    const resource = resourceFor(path);
    if (!resource) return;
    const action = readMethods.has(request.method) || path === "/api/v1/compensation/calculate" || path === "/api/v1/compensation/competitiveness" ? "read" : "write";
    if (!permissionsFor(actor.role).includes(`${resource}:${action}`)) {
      return reply.code(403).send({ error: { code: "PERMISSION_DENIED", message: "没有访问此资源的权限", requestId: request.id } });
    }
  });

  app.addHook("onResponse", async (request, reply) => {
    if (reply.elapsedTime > 1000) request.log.warn({ durationMs: reply.elapsedTime, route: request.routeOptions.url, requestId: request.id }, "slow API request");
    if (!audit || reply.statusCode >= 400) return;
    const actor = getActor(request);
    const path = request.url.split("?")[0] ?? "";
    const resource = resourceFor(path);
    if (!actor || !resource) return;
    const isWrite = !readMethods.has(request.method) && path !== "/api/v1/compensation/calculate";
    const sensitiveRead = (request.method === "GET" || request.method === "HEAD") && (
      path === "/api/v1/me" || path.startsWith("/api/v1/admin/") ||
      ["talents", "leaders", "organizations", "search-projects", "research-tasks", "search", "ai", "market-data", "mapping", "compensation", "level-benchmarks", "mail"].includes(path.split("/")[3] ?? "")
    );
    if (!isWrite && !sensitiveRead && path !== "/api/v1/compensation/calculate") return;
    const params = request.params as Record<string, string>;
    const resourceId = params.candidateId ?? params.evidenceId ?? params.leaderId ?? params.id ?? params.taskId ?? params.recommendationId ?? params.name ?? null;
    try {
      await audit({ actorId: actor.id, action: path === "/api/v1/me" ? "session.access" : `${request.method.toLowerCase()}.${resource}`, resource, resourceId, requestId: request.id });
    } catch {
      request.log.error({ resource, requestId: request.id }, "audit write failed");
    }
  });
  return getActor;
}
