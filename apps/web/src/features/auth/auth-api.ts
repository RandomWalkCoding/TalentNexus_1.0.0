import { meResponseSchema, loginRequestSchema } from "@hr-console/contracts";
import type { LoginRequest, MeResponse } from "@hr-console/contracts";

async function request(path: string, options: RequestInit = {}): Promise<unknown> {
  const response = await fetch(`/api/v1/${path}`, { ...options, headers: { "content-type": "application/json", ...options.headers } });
  const body = await response.json().catch(() => null);
  if (!response.ok) throw new Error(body?.error?.message ?? "请求失败，请重试");
  return body;
}

export async function login(input: LoginRequest): Promise<MeResponse> {
  const parsed = loginRequestSchema.parse(input);
  return meResponseSchema.parse(await request("auth/login", { method: "POST", body: JSON.stringify(parsed) }));
}

export async function getCurrentUser(signal?: AbortSignal): Promise<MeResponse> {
  const response = await fetch("/api/v1/me", signal ? { signal } : {});
  if (!response.ok) throw new Error("未登录");
  return meResponseSchema.parse(await response.json());
}

export async function logout(): Promise<void> {
  await request("auth/logout", { method: "POST" });
}
