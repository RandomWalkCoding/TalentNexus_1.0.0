import { searchResponseSchema } from "@hr-console/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PrismaClient } from "../generated/client/index.js";
import { permissionsFor, type Actor } from "./admin.js";

export function searchRoutes(app: FastifyInstance, db: PrismaClient, getActor: (request: FastifyRequest) => Actor | null): void {
  app.get<{ Querystring: { q?: string } }>("/api/v1/search", async (request, reply) => {
    const query = typeof request.query.q === "string" ? request.query.q.trim() : "";
    if (query.length < 2 || query.length > 80) return reply.code(400).send({ error: { code: "VALIDATION_ERROR", message: "搜索词需要 2 至 80 个字符", requestId: request.id } });
    const actor = getActor(request);
    if (!actor) return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "请先登录", requestId: request.id } });
    const permissions = new Set(permissionsFor(actor.role));
    const contains = { contains: query, mode: "insensitive" as const };
    const orderBy = [{ updatedAt: "desc" as const }, { id: "asc" as const }];
    const [talents, companies, users, organizations, leaders, tasks, projects] = await Promise.all([
      permissions.has("talents:read") ? db.talent.findMany({ where: { OR: [{ name: contains }, { title: contains }, { company: contains }, { category: contains }] }, select: { id: true, name: true, title: true, company: true }, orderBy, take: 5 }) : [],
      permissions.has("competitors:read") ? db.company.findMany({ where: { OR: [{ name: contains }, { industry: contains }, { region: contains }] }, select: { id: true, name: true, industry: true, region: true }, orderBy, take: 5 }) : [],
      permissions.has("admin:read") ? db.adminUser.findMany({ where: { OR: [{ name: contains }, { email: contains }] }, select: { id: true, name: true, email: true }, orderBy, take: 5 }) : [],
      permissions.has("organizations:read") ? db.organizationUnit.findMany({ where: { OR: [{ name: contains }, { role: contains }] }, select: { id: true, name: true, role: true, kind: true }, orderBy, take: 5 }) : [],
      permissions.has("leaders:read") && permissions.has("organizations:read") ? db.leaderProfile.findMany({ where: { OR: [{ name: contains }, { currentTitle: contains }] }, select: { id: true, name: true, currentTitle: true }, orderBy, take: 5 }) : [],
      permissions.has("research-tasks:read") ? db.researchTask.findMany({ where: { OR: [{ name: contains }, { target: contains }] }, select: { id: true, name: true, target: true }, orderBy, take: 5 }) : [],
      permissions.has("search-projects:read") ? db.searchProject.findMany({ where: { OR: [{ name: contains }, { targetRole: contains }] }, select: { id: true, name: true, targetRole: true }, orderBy, take: 5 }) : []
    ]);
    return searchResponseSchema.parse({ items: [
      ...talents.map((item) => ({ id: item.id, kind: "talent", title: item.name, subtitle: `${item.title} · ${item.company}`, href: `/talent-pool?q=${encodeURIComponent(item.name)}` })),
      ...companies.map((item) => ({ id: item.id, kind: "company", title: item.name, subtitle: `${item.industry} · ${item.region}`, href: `/competitor-monitoring?company=${encodeURIComponent(item.name)}` })),
      ...users.map((item) => ({ id: item.id, kind: "user", title: item.name, subtitle: item.email, href: "/admin" })),
      ...organizations.map((item) => ({ id: item.id, kind: "organization", title: item.name, subtitle: item.role ?? item.kind, href: `/organizations?unit=${item.id}` })),
      ...leaders.map((item) => ({ id: item.id, kind: "leader", title: item.name, subtitle: item.currentTitle ?? "领队档案", href: `/organizations?leader=${item.id}` })),
      ...tasks.map((item) => ({ id: item.id, kind: "research-task", title: item.name, subtitle: item.target, href: `/research-tasks?q=${encodeURIComponent(item.name)}` })),
      ...projects.map((item) => ({ id: item.id, kind: "search-project", title: item.name, subtitle: item.targetRole, href: `/search-projects?project=${item.id}` }))
    ], requestId: request.id });
  });
}
