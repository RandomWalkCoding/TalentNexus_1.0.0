import { adminListResponseSchema, adminUserSchema, dictionarySchema, auditLogSchema, meResponseSchema, roleSchema } from "@hr-console/contracts";

export async function adminRequest(path: string, options: RequestInit = {}) {
  const timeout = AbortSignal.timeout(15000);
  let response: Response;
  try { response = await fetch(`/api/v1/${path}`, { ...options, signal: options.signal ? AbortSignal.any([options.signal, timeout]) : timeout }); }
  catch (error) { if (timeout.aborted) throw new Error("请求超时，请重试"); if (options.signal?.aborted) throw error; throw new Error("无法连接服务，请检查网络后重试"); }
  if (!response.ok) {
    const body = await response.json().catch(() => null);
    throw new Error(response.status === 403 ? "没有访问此资源的权限" : response.status === 401 ? "账户不可用，请联系管理员" : body?.error?.message ?? "请求失败，请重试");
  }
  return response.json();
}
export const loadMe = (signal?: AbortSignal) => adminRequest("me", signal ? { signal } : {}).then((body) => meResponseSchema.parse(body));
export const loadRoles = (signal?: AbortSignal) => adminRequest("admin/roles", signal ? { signal } : {}).then((body) => roleSchema.array().parse(body.items));
export const loadUsers = (query: string, signal: AbortSignal) => adminRequest(`admin/users?${query}`, { signal }).then((body) => adminListResponseSchema(adminUserSchema).parse(body));
export const loadDictionaries = (query: string, signal: AbortSignal) => adminRequest(`admin/dictionaries?${query}`, { signal }).then((body) => adminListResponseSchema(dictionarySchema).parse(body));
export const loadLogs = (query: string, signal: AbortSignal) => adminRequest(`admin/audit-logs?${query}`, { signal }).then((body) => adminListResponseSchema(auditLogSchema).parse(body));
export const adminWrite = (path: string, method: "POST" | "PATCH", input: unknown) => adminRequest(path, { method, headers: { "content-type": "application/json" }, body: JSON.stringify(input) });
