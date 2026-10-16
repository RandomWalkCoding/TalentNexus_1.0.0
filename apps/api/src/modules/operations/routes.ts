import {
  competitorListQuerySchema,
  competitorMonitorUpdateSchema,
  intelligenceListQuerySchema
} from "@hr-console/contracts";
import type { FastifyPluginAsync, FastifyReply } from "fastify";
import { z } from "zod";

import type { OperationsService } from "./service.js";

type RouteOptions = { service: OperationsService };
const resourceIdSchema = z.string().uuid();

function validationError(reply: FastifyReply, requestId: string, issues: z.ZodIssue[]) {
  return reply.code(400).send({
    error: { code: "VALIDATION_ERROR", message: "请求参数无效", details: issues, requestId }
  });
}

function notFound(reply: FastifyReply, requestId: string, resource: string) {
  return reply.code(404).send({
    error: { code: "NOT_FOUND", message: `${resource}不存在`, requestId }
  });
}

export const operationsRoutes: FastifyPluginAsync<RouteOptions> = async (app, { service }) => {
  app.get<{ Querystring: Record<string, string | undefined> }>("/api/v1/intelligence", async (request, reply) => {
    const parsed = intelligenceListQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, request.id, parsed.error.issues);
    const result = await service.listIntelligence(parsed.data);
    return { ...result, requestId: request.id };
  });

  app.get<{ Params: { id: string } }>("/api/v1/intelligence/:id", async (request, reply) => {
    const parsedId = resourceIdSchema.safeParse(request.params.id);
    if (!parsedId.success) return validationError(reply, request.id, parsedId.error.issues);
    const item = await service.getIntelligence(parsedId.data);
    return item ?? notFound(reply, request.id, "情报");
  });

  app.get<{ Querystring: Record<string, string | undefined> }>("/api/v1/competitors", async (request, reply) => {
    const parsed = competitorListQuerySchema.safeParse(request.query);
    if (!parsed.success) return validationError(reply, request.id, parsed.error.issues);
    const result = await service.listCompetitors(parsed.data);
    return { ...result, requestId: request.id };
  });

  app.get<{ Params: { id: string } }>("/api/v1/competitors/:id", async (request, reply) => {
    const parsedId = resourceIdSchema.safeParse(request.params.id);
    if (!parsedId.success) return validationError(reply, request.id, parsedId.error.issues);
    const competitor = await service.getCompetitor(parsedId.data);
    return competitor ?? notFound(reply, request.id, "竞对");
  });

  app.patch<{ Params: { id: string }; Body: unknown }>("/api/v1/competitors/:id/monitor", async (request, reply) => {
    const parsedId = resourceIdSchema.safeParse(request.params.id);
    if (!parsedId.success) return validationError(reply, request.id, parsedId.error.issues);
    const input = competitorMonitorUpdateSchema.safeParse(request.body);
    if (!input.success) return validationError(reply, request.id, input.error.issues);
    const competitor = await service.setCompetitorMonitoring(parsedId.data, input.data.monitored);
    if (!competitor) return notFound(reply, request.id, "竞对");
    return { ok: true as const, message: competitor.monitored ? "已启用监测" : "已停用监测" };
  });
};
