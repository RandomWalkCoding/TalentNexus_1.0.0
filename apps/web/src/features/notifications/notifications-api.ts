import { notificationsResponseSchema } from "@hr-console/contracts";
import type { NotificationsResponse } from "@hr-console/contracts";

export async function getNotifications(signal?: AbortSignal): Promise<NotificationsResponse> {
  const response = await fetch("/api/v1/notifications", signal ? { signal } : {});
  if (!response.ok) throw new Error("通知加载失败");
  return notificationsResponseSchema.parse(await response.json());
}

export async function markNotificationsRead(): Promise<void> {
  const response = await fetch("/api/v1/notifications/read-all", { method: "POST" });
  if (!response.ok) throw new Error("通知状态更新失败");
}
