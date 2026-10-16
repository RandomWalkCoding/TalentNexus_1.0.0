import {
  benchmarkStructureSchema, levelMappingsSchema, competitivenessSchema, competitivenessInputSchema,
  benchmarkFilterSchema, levelMappingReviewSchema,
  type BenchmarkFilter, type CompetitivenessInput, type LevelMappingReview
} from "@hr-console/contracts";

async function request(url: string, options?: RequestInit): Promise<unknown> {
  const response = await fetch(`/api/v1/${url}`, options);
  if (!response.ok) {
    if (response.status === 401 || response.status === 403) throw new Error("没有访问权限，请登录或联系管理员。");
    if (response.status === 409) throw new Error("记录已更新，请刷新后重试。");
    const body = await response.json().catch(() => null) as { error?: { message?: string } } | null;
    throw new Error(body?.error?.message ?? "服务暂时不可用，请稍后重试。");
  }
  return response.json();
}
function query(filters: Partial<BenchmarkFilter>) {
  const parsed = benchmarkFilterSchema.parse(filters);
  const params = new URLSearchParams();
  for (const [key, value] of Object.entries(parsed)) if (value) params.set(key, value);
  return params.toString();
}
export async function getStructure(filters: Partial<BenchmarkFilter>, signal?: AbortSignal) {
  return benchmarkStructureSchema.parse(await request(`compensation/structure?${query(filters)}`, signal ? { signal } : {}));
}
export async function getLevelMappings(filters: Partial<BenchmarkFilter>, signal?: AbortSignal) {
  return levelMappingsSchema.parse(await request(`level-benchmarks?${query(filters)}`, signal ? { signal } : {}));
}
export async function reviewLevelMapping(id: string, review: LevelMappingReview) {
  return request(`level-benchmarks/${id}`, { method: "PATCH", headers: { "content-type": "application/json" }, body: JSON.stringify(levelMappingReviewSchema.parse(review)) });
}
export async function compareCompetitiveness(input: CompetitivenessInput, signal?: AbortSignal) {
  return competitivenessSchema.parse(await request("compensation/competitiveness", { method: "POST", headers: { "content-type": "application/json" }, body: JSON.stringify(competitivenessInputSchema.parse(input)), ...(signal ? { signal } : {}) }));
}
export function exportBenchmark(report: { snapshotId: string }) {
  const blob = new Blob([JSON.stringify(report, null, 2)], { type: "application/json;charset=utf-8" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = `benchmark-${report.snapshotId}.json`;
  link.click();
  URL.revokeObjectURL(url);
}
