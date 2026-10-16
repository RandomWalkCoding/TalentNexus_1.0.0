import { searchResponseSchema } from "@hr-console/contracts";
import type { SearchResult } from "@hr-console/contracts";

export async function searchWorkspace(query: string, signal?: AbortSignal): Promise<SearchResult[]> {
  if (query.trim().length < 2) return [];
  const response = await fetch(`/api/v1/search?q=${encodeURIComponent(query.trim())}`, signal ? { signal } : {});
  if (!response.ok) throw new Error("搜索暂时不可用");
  return searchResponseSchema.parse(await response.json()).items;
}
