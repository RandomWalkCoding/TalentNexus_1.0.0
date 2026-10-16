import { notificationsResponseSchema } from "@hr-console/contracts";
import type { FastifyInstance, FastifyRequest } from "fastify";
import type { PrismaClient } from "../generated/client/index.js";
import type { Actor } from "./admin.js";

export function notificationRoutes(app: FastifyInstance, db: PrismaClient, getActor: (request: FastifyRequest) => Actor | null): void {
  app.get("/api/v1/notifications", async (request, reply) => {
    const actor = getActor(request);
    if (!actor) return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "请先登录", requestId: request.id } });
    const [items, unreadCount] = await Promise.all([
      db.notification.findMany({ where: { userId: actor.id }, orderBy: { createdAt: "desc" }, take: 50 }),
      db.notification.count({ where: { userId: actor.id, read: false } })
    ]);
    return notificationsResponseSchema.parse({
      items: items.map((item) => ({ id: item.id, title: item.title, body: item.body, read: item.read, href: item.href, createdAt: item.createdAt.toISOString() })),
      unreadCount,
      requestId: request.id
    });
  });

  app.post("/api/v1/notifications/read-all", async (request, reply) => {
    const actor = getActor(request);
    if (!actor) return reply.code(401).send({ error: { code: "UNAUTHORIZED", message: "请先登录", requestId: request.id } });
    await db.notification.updateMany({ where: { userId: actor.id, read: false }, data: { read: true } });
    return { ok: true, requestId: request.id };
  });
}
