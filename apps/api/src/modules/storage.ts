import { storageStatusSchema } from "@hr-console/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PrismaClient } from "../generated/client/index.js";
import type { Actor } from "./admin.js";

const scopes = ["用户与权限", "个人偏好", "通知", "操作日志", "人才与公司数据", "薪酬假设与计算快照"];

export function storageRoutes(app: FastifyInstance, db: PrismaClient, getActor: (request: FastifyRequest) => Actor | null): void {
  app.get("/api/v1/storage/status", async (request, reply) => {
    if (!getActor(request)) return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "请先登录", requestId: request.id } });
    let connected = false;
    let lastSyncedAt: string | null = null;
    try {
      const rows = await db.$queryRaw<Array<{ now: Date }>>`SELECT NOW() AS now`;
      connected = rows.length > 0;
      lastSyncedAt = rows[0]?.now.toISOString() ?? null;
    } catch (error) {
      request.log.warn({ err: error, requestId: request.id }, "cloud storage status unavailable");
    }
    return storageStatusSchema.parse({ provider: "postgresql", connected, lastSyncedAt, scopes, requestId: request.id });
  });
}
